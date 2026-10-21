import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../api/src/testing';
import { savingsMode } from './limits';
import { runMonitor, type MonitorEnv } from './monitor';

let env: MonitorEnv;
let dispose: () => Promise<void>;
beforeEach(async () => {
  const t = await testDb();
  dispose = t.dispose;
  env = { DB: t.DB, ACCOUNT_ID: 'conta', DATABASE_ID: 'base', CF_ANALYTICS_TOKEN: 'token-teste' };
});
afterEach(() => dispose());

const at = (iso: string) => Date.parse(iso) / 1000;

/** Resposta falsa da GraphQL Analytics API com o uso indicado. */
function analytics(use: {
  requests?: number;
  rowsRead?: number;
  rowsWritten?: number;
  size?: number;
}) {
  const calls: { auth: string | null; body: { variables: Record<string, string> } }[] = [];
  const fetchFn = (async (_url: string, init: RequestInit) => {
    calls.push({
      auth: new Headers(init.headers).get('authorization'),
      body: JSON.parse(init.body as string),
    });
    return Response.json({
      data: {
        viewer: {
          accounts: [
            {
              workers: [{ sum: { requests: use.requests ?? 10 } }],
              d1: [{ sum: { rowsRead: use.rowsRead ?? 100, rowsWritten: use.rowsWritten ?? 5 } }],
              storage: [
                {
                  max: { databaseSizeBytes: 1000 },
                  dimensions: { date: '2026-10-19', databaseId: 'base' },
                },
                {
                  max: { databaseSizeBytes: use.size ?? 2000 },
                  dimensions: { date: '2026-10-20', databaseId: 'base' },
                },
                {
                  max: { databaseSizeBytes: 500 },
                  dimensions: { date: '2026-10-20', databaseId: 'outra' },
                },
              ],
            },
          ],
        },
      },
      errors: null,
    });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

async function usage(date: string) {
  const { results } = await env.DB.prepare('SELECT metric, value FROM usage_daily WHERE date = ?')
    .bind(date)
    .all<{ metric: string; value: number }>();
  return Object.fromEntries(results.map((r) => [r.metric, r.value]));
}

describe('monitor', () => {
  it('grava o uso do dia (UTC) com um valor por métrica', async () => {
    const { fetchFn, calls } = analytics({ requests: 1234, rowsRead: 5000, rowsWritten: 40 });
    const r = await runMonitor(env, at('2026-10-20T13:05:00Z'), fetchFn);
    expect(calls[0]!.auth).toBe('Bearer token-teste');
    expect(calls[0]!.body.variables).toMatchObject({ account: 'conta', date: '2026-10-20' });
    expect(r.alerts).toEqual([]);
    expect(r.savings).toBeNull();
    expect(await usage('2026-10-20')).toMatchObject({
      pedidos_worker: 1234,
      d1_linhas_lidas: 5000,
      d1_linhas_escritas: 40,
      d1_armazenamento: 2000,
      conta_armazenamento: 2500,
      contas: 0,
      chamadas_ia: 0,
    });
    // Na hora seguinte o valor é substituído, não somado.
    await runMonitor(env, at('2026-10-20T14:05:00Z'), analytics({ requests: 2000 }).fetchFn);
    expect((await usage('2026-10-20')).pedidos_worker).toBe(2000);
  });

  it('aos 70% regista um alerta, só uma vez por dia', async () => {
    const fetchFn = analytics({ rowsWritten: 75_000 }).fetchFn;
    const r1 = await runMonitor(env, at('2026-10-20T10:05:00Z'), fetchFn);
    expect(r1.alerts).toEqual([{ metric: 'd1_linhas_escritas', threshold: 70, value: 75_000 }]);
    expect(r1.savings).toBeNull();
    const r2 = await runMonitor(env, at('2026-10-20T11:05:00Z'), fetchFn);
    expect(r2.alerts).toEqual([]);
    // No dia seguinte pode voltar a alertar.
    const r3 = await runMonitor(env, at('2026-10-21T11:05:00Z'), fetchFn);
    expect(r3.alerts).toHaveLength(1);
  });

  it('simulando 90%: alerta, liga o modo poupança e desliga-o sozinho à meia-noite UTC', async () => {
    const t = at('2026-10-20T15:05:00Z');
    const r = await runMonitor(env, t, analytics({ requests: 91_000 }).fetchFn);
    expect(r.alerts.map((a) => a.threshold)).toEqual([70, 90]);
    expect(r.savings).toBe('ligado');
    const mode = await savingsMode(env.DB, t);
    expect(mode).toEqual({ ate: at('2026-10-21T00:00:00Z'), motivo: ['pedidos_worker'] });

    // Na hora seguinte mantém-se, sem novo alerta.
    const r2 = await runMonitor(env, t + 3600, analytics({ requests: 95_000 }).fetchFn);
    expect(r2.savings).toBe('mantido');
    expect(r2.alerts).toEqual([]);

    // Às 00:00 UTC acaba sozinho, mesmo antes de o monitor voltar a correr.
    expect(await savingsMode(env.DB, at('2026-10-20T23:59:59Z'))).not.toBeNull();
    expect(await savingsMode(env.DB, at('2026-10-21T00:00:00Z'))).toBeNull();
    // E o monitor limpa o registo com o uso do novo dia.
    const r3 = await runMonitor(
      env,
      at('2026-10-21T00:05:00Z'),
      analytics({ requests: 50 }).fetchFn,
    );
    expect(r3.savings).toBe('desligado');
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM settings').first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it('o armazenamento alerta mas não liga o modo poupança', async () => {
    const r = await runMonitor(
      env,
      at('2026-10-20T15:05:00Z'),
      analytics({ size: 460 * 1024 * 1024 }).fetchFn,
    );
    expect(r.alerts.map((a) => `${a.metric}:${a.threshold}`)).toEqual([
      'd1_armazenamento:70',
      'd1_armazenamento:90',
    ]);
    expect(r.savings).toBeNull();
  });

  it('sem estatísticas: regista o problema e usa o tamanho da própria base', async () => {
    const failing = (async () => new Response('erro', { status: 401 })) as unknown as typeof fetch;
    const r = await runMonitor(env, at('2026-10-20T15:05:00Z'), failing);
    expect(r.analyticsError).toBe('HTTP 401');
    expect(r.alerts).toEqual([{ metric: 'monitor', threshold: 0, value: 0 }]);
    expect(r.values.d1_armazenamento).toBeGreaterThan(0);
    expect(r.values.pedidos_worker).toBeUndefined();
  });

  it('conta utilizadores ativos, contas, cópias e chamadas de IA', async () => {
    const t = at('2026-10-20T15:05:00Z');
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, created_at, last_seen_at) VALUES ('a', 0, ?)").bind(
        t - 3600,
      ),
      env.DB.prepare("INSERT INTO users (id, created_at, last_seen_at) VALUES ('b', 0, ?)").bind(
        t - 5 * 86400,
      ),
      env.DB.prepare(
        "INSERT INTO backup_versions (user_id, version, chunk_count, size, status, created_at) VALUES ('a', 1, 1, 3000, 'complete', 0)",
      ),
      env.DB.prepare(
        "INSERT INTO ai_usage_daily (date, user_id, provider, calls) VALUES ('2026-10-20', 'a', 'gemini-admin', 7)",
      ),
    ]);
    const r = await runMonitor({ ...env, CF_ANALYTICS_TOKEN: undefined }, t);
    expect(r.values).toMatchObject({
      utilizadores_ativos: 1,
      contas: 2,
      copias_bytes: 3000,
      chamadas_ia: 7,
    });
  });
});
