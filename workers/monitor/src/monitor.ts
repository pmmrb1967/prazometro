import { readAnalytics } from './analytics';
import { alertMessage, sendWhatsApp } from './notify';
import {
  METRICS,
  nextUtcMidnight,
  SAVINGS_KEY,
  SAVINGS_THRESHOLD,
  THRESHOLDS,
  utcDate,
  type Metric,
  type SavingsMode,
} from './limits';

// Corre de hora a hora: lê o uso do dia, grava um valor por métrica, regista os alertas
// (70% e 90%, no máximo um por métrica, patamar e dia) e liga ou desliga o modo poupança.

export type MonitorEnv = {
  DB: D1Database;
  ACCOUNT_ID: string;
  DATABASE_ID: string;
  CF_ANALYTICS_TOKEN?: string;
  /** Segredos do CallMeBot: número do admin com indicativo (+351…) e a chave recebida. */
  WHATSAPP_PHONE?: string;
  WHATSAPP_APIKEY?: string;
};

export type Alert = { metric: Metric | 'monitor'; threshold: number; value: number };

export type MonitorResult = {
  date: string;
  values: Partial<Record<Metric, number>>;
  alerts: Alert[];
  savings: 'ligado' | 'mantido' | 'desligado' | null;
  analyticsError?: string;
  /** 'enviado', 'sem_canal' (faltam os segredos) ou a mensagem de erro do envio. */
  whatsapp?: string;
};

export async function runMonitor(
  env: MonitorEnv,
  now: number,
  fetchFn: typeof fetch = fetch,
): Promise<MonitorResult> {
  const db = env.DB;
  const date = utcDate(now);
  const result: MonitorResult = { date, values: {}, alerts: [], savings: null };
  const values = result.values;

  if (env.CF_ANALYTICS_TOKEN) {
    try {
      Object.assign(
        values,
        await readAnalytics(
          {
            token: env.CF_ANALYTICS_TOKEN,
            accountId: env.ACCOUNT_ID,
            databaseId: env.DATABASE_ID,
            date,
          },
          fetchFn,
        ),
      );
    } catch (e) {
      result.analyticsError = e instanceof Error ? e.message : 'erro';
    }
  }

  // Sem estatísticas, o tamanho da base sai da própria consulta (meta.size_after).
  const [ping, active, accounts, copies, ai, free] = await db.batch([
    db.prepare('SELECT 1'),
    db.prepare('SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= ?').bind(now - 86400),
    db.prepare('SELECT COUNT(*) AS n FROM users'),
    db.prepare("SELECT COALESCE(SUM(size), 0) AS n FROM backup_versions WHERE status = 'complete'"),
    db.prepare('SELECT COALESCE(SUM(calls), 0) AS n FROM ai_usage_daily WHERE date = ?').bind(date),
    db
      .prepare(
        'SELECT COALESCE(SUM(calls), 0) AS n, COALESCE(SUM(neurons), 0) AS neurons FROM ai_free_daily WHERE date = ?',
      )
      .bind(date),
  ]);
  const n = (r: D1Result | undefined) => (r!.results[0] as { n: number }).n;
  values.d1_armazenamento ??= ping!.meta.size_after;
  values.utilizadores_ativos = n(active);
  values.contas = n(accounts);
  values.copias_bytes = n(copies);
  const freeRow = free!.results[0] as { n: number; neurons: number };
  values.chamadas_ia = n(ai) + freeRow.n;
  values.ia_neurons = freeRow.neurons;

  const entries = Object.entries(values) as [Metric, number][];
  const statements = entries.map(([metric, value]) =>
    db
      .prepare(
        `INSERT INTO usage_daily (date, metric, value, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (date, metric) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(date, metric, value, now),
  );

  // A IA gratuita só precisa do dia de hoje: apaga os dias anteriores.
  statements.push(db.prepare('DELETE FROM ai_free_daily WHERE date < ?').bind(date));

  // Alertas: a chave primária de alerts_sent impede repetir o mesmo no mesmo dia.
  const candidates: Alert[] = [];
  const overDaily: Metric[] = [];
  for (const [metric, value] of entries) {
    const limit = METRICS[metric].limite;
    if (!limit) continue;
    const pct = (value / limit) * 100;
    for (const t of THRESHOLDS) if (pct >= t) candidates.push({ metric, threshold: t, value });
    const info = METRICS[metric];
    if (info.diario && !info.sem_poupanca && pct >= SAVINGS_THRESHOLD) overDaily.push(metric);
  }
  if (result.analyticsError) candidates.push({ metric: 'monitor', threshold: 0, value: 0 });
  const alertStart = statements.length;
  for (const a of candidates) {
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO alerts_sent (date, metric, threshold, value, sent_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(date, a.metric, a.threshold, a.value, now),
    );
  }

  // Modo poupança: liga aos 90% de um limite diário e dura até à meia-noite UTC seguinte.
  const current = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(SAVINGS_KEY)
    .first<{ value: string }>();
  const savingsActive = current && (JSON.parse(current.value) as SavingsMode).ate > now;
  if (overDaily.length) {
    const mode: SavingsMode = { ate: nextUtcMidnight(now), motivo: overDaily };
    statements.push(
      db
        .prepare(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .bind(SAVINGS_KEY, JSON.stringify(mode), now),
    );
    result.savings = savingsActive ? 'mantido' : 'ligado';
  } else if (current && !savingsActive) {
    statements.push(db.prepare('DELETE FROM settings WHERE key = ?').bind(SAVINGS_KEY));
    result.savings = 'desligado';
  }

  const results = statements.length ? await db.batch(statements) : [];
  result.alerts = candidates.filter((_, i) => results[alertStart + i]!.meta.changes === 1);

  // Envio dos alertas novos ao admin. Ficam sempre em alerts_sent e no painel, mesmo se o
  // envio falhar; não se repete na hora seguinte (um aviso por métrica, patamar e dia).
  if (result.alerts.length) {
    if (!env.WHATSAPP_PHONE || !env.WHATSAPP_APIKEY) {
      result.whatsapp = 'sem_canal';
    } else {
      try {
        await sendWhatsApp(
          { phone: env.WHATSAPP_PHONE, apikey: env.WHATSAPP_APIKEY },
          alertMessage(date, result.alerts, result.savings === 'ligado'),
          fetchFn,
        );
        result.whatsapp = 'enviado';
      } catch (e) {
        result.whatsapp = e instanceof Error ? e.message : 'WhatsApp: erro';
      }
    }
  }
  return result;
}
