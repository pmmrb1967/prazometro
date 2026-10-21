import { Hono } from 'hono';
import { z } from 'zod';
import { METRICS, SAVINGS_KEY, savingsMode, utcDate } from '../../monitor/src/limits';
import { HttpError, now, requireAdmin, requireUser, type AppEnv } from './lib';

// Painel de admin: uso dos últimos dias, alertas, modo poupança e relatos de regras.
// Só para contas com papel 'admin' e sessão aberta com passkey.

export const admin = new Hono<AppEnv>();
admin.use('*', requireUser, requireAdmin);

const STATUSES = ['novo', 'em_analise', 'resolvido', 'rejeitado'] as const;

admin.get('/usage', async (c) => {
  const days = Math.min(90, Math.max(1, Number(c.req.query('dias') ?? 30) || 30));
  const t = now();
  const since = utcDate(t - (days - 1) * 86400);
  const db = c.env.DB;
  const [usage, alerts, reports] = await db.batch([
    db
      .prepare(
        'SELECT date, metric, value, updated_at FROM usage_daily WHERE date >= ? ORDER BY date',
      )
      .bind(since),
    db
      .prepare(
        'SELECT date, metric, threshold, value, sent_at FROM alerts_sent WHERE date >= ? ORDER BY sent_at DESC LIMIT 100',
      )
      .bind(since),
    db.prepare("SELECT COUNT(*) AS n FROM rule_reports WHERE status = 'novo'"),
  ]);
  return c.json({
    desde: since,
    hoje: utcDate(t),
    metricas: METRICS,
    uso: usage!.results,
    alertas: alerts!.results,
    modo_poupanca: await savingsMode(db, t),
    relatos_novos: (reports!.results[0] as { n: number }).n,
  });
});

/** Desliga o modo poupança antes da hora (por exemplo, depois de resolver a causa). */
admin.delete('/savings', async (c) => {
  await c.env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(SAVINGS_KEY).run();
  return c.json({ ok: true });
});

admin.get('/reports', async (c) => {
  const status = c.req.query('estado');
  const db = c.env.DB;
  const stmt =
    status && (STATUSES as readonly string[]).includes(status)
      ? db
          .prepare(
            'SELECT id, rule_id, message, created_at, status, updated_at FROM rule_reports WHERE status = ? ORDER BY created_at DESC LIMIT 200',
          )
          .bind(status)
      : db.prepare(
          'SELECT id, rule_id, message, created_at, status, updated_at FROM rule_reports ORDER BY created_at DESC LIMIT 200',
        );
  return c.json({ relatos: (await stmt.all()).results });
});

admin.patch('/reports/:id', async (c) => {
  const parsed = z
    .object({ status: z.enum(STATUSES) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, 'Estado inválido.');
  const res = await c.env.DB.prepare(
    'UPDATE rule_reports SET status = ?, updated_at = ? WHERE id = ?',
  )
    .bind(parsed.data.status, now(), c.req.param('id'))
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Relato não encontrado.');
  return c.json({ ok: true });
});
