// Métricas acompanhadas e limites do plano gratuito da Cloudflare (ver CLAUDE.md).
// Partilhado pelo Worker monitor (que grava e alerta) e pela API (que mostra no painel).

const MB = 1024 * 1024;

export type Metric =
  | 'pedidos_worker'
  | 'd1_linhas_lidas'
  | 'd1_linhas_escritas'
  | 'd1_armazenamento'
  | 'conta_armazenamento'
  | 'chamadas_ia'
  | 'utilizadores_ativos'
  | 'contas'
  | 'copias_bytes';

export type MetricInfo = {
  rotulo: string;
  unidade: 'numero' | 'bytes';
  /** Limite do plano gratuito; sem limite, a métrica só aparece no painel. */
  limite?: number;
  /** Os limites diários reiniciam às 00:00 UTC; os de armazenamento não. */
  diario?: boolean;
};

export const METRICS: Record<Metric, MetricInfo> = {
  pedidos_worker: {
    rotulo: 'Pedidos aos Workers',
    unidade: 'numero',
    limite: 100_000,
    diario: true,
  },
  d1_linhas_lidas: {
    rotulo: 'Linhas lidas no D1',
    unidade: 'numero',
    limite: 5_000_000,
    diario: true,
  },
  d1_linhas_escritas: {
    rotulo: 'Linhas escritas no D1',
    unidade: 'numero',
    limite: 100_000,
    diario: true,
  },
  d1_armazenamento: { rotulo: 'Tamanho da base D1', unidade: 'bytes', limite: 500 * MB },
  conta_armazenamento: { rotulo: 'D1 em toda a conta', unidade: 'bytes', limite: 5 * 1024 * MB },
  chamadas_ia: { rotulo: 'Chamadas de IA (chave do admin)', unidade: 'numero' },
  utilizadores_ativos: { rotulo: 'Utilizadores ativos', unidade: 'numero' },
  contas: { rotulo: 'Contas', unidade: 'numero' },
  copias_bytes: { rotulo: 'Cópias na nuvem', unidade: 'bytes' },
};

/** Patamares de alerta, em percentagem do limite. */
export const THRESHOLDS = [70, 90] as const;
/** A partir deste patamar, num limite diário, liga-se o modo poupança. */
export const SAVINGS_THRESHOLD = 90;

export const SAVINGS_KEY = 'modo_poupanca';

export type SavingsMode = { ate: number; motivo: Metric[] };

/** Modo poupança em vigor, ou null. Acaba sozinho à hora marcada (00:00 UTC seguinte). */
export async function savingsMode(db: D1Database, now: number): Promise<SavingsMode | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(SAVINGS_KEY)
    .first<{ value: string }>();
  if (!row) return null;
  const mode = JSON.parse(row.value) as SavingsMode;
  return mode.ate > now ? mode : null;
}

/** Data UTC (AAAA-MM-DD) de um instante em segundos. */
export const utcDate = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);

/** Instante (segundos) da próxima meia-noite UTC. */
export function nextUtcMidnight(seconds: number) {
  const d = new Date(seconds * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) / 1000;
}
