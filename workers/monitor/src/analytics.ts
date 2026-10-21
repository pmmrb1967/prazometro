import type { Metric } from './limits';

// Leitura da GraphQL Analytics API da Cloudflare, com um token só de leitura
// ("Account Analytics: Read"). Os limites diários contam para toda a conta.

const QUERY = `query Uso($account: string!, $date: Date!, $since: Date!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workers: workersInvocationsAdaptive(limit: 1000, filter: { date_geq: $date, date_leq: $date }) {
        sum { requests }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date_geq: $date, date_leq: $date }) {
        sum { rowsRead rowsWritten }
      }
      storage: d1StorageAdaptiveGroups(limit: 1000, filter: { date_geq: $since }) {
        max { databaseSizeBytes }
        dimensions { date databaseId }
      }
    }
  }
}`;

type Response = {
  data?: {
    viewer: {
      accounts: {
        workers: { sum: { requests: number } }[];
        d1: { sum: { rowsRead: number; rowsWritten: number } }[];
        storage: {
          max: { databaseSizeBytes: number };
          dimensions: { date: string; databaseId: string };
        }[];
      }[];
    };
  };
  errors?: { message: string }[] | null;
};

export class AnalyticsError extends Error {}

const daysBefore = (date: string, n: number) =>
  new Date(Date.parse(date) - n * 86400_000).toISOString().slice(0, 10);

export async function readAnalytics(
  opts: { token: string; accountId: string; databaseId: string; date: string },
  fetchFn: typeof fetch = fetch,
): Promise<Partial<Record<Metric, number>>> {
  const res = await fetchFn('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${opts.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: { account: opts.accountId, date: opts.date, since: daysBefore(opts.date, 3) },
    }),
  });
  if (!res.ok) throw new AnalyticsError(`HTTP ${res.status}`);
  const json = (await res.json()) as Response;
  const account = json.data?.viewer.accounts[0];
  if (json.errors?.length || !account) {
    throw new AnalyticsError(json.errors?.[0]?.message ?? 'resposta sem dados');
  }

  // Tamanho mais recente de cada base; a conta soma todas.
  const latest = new Map<string, { date: string; size: number }>();
  for (const s of account.storage) {
    const prev = latest.get(s.dimensions.databaseId);
    if (!prev || s.dimensions.date >= prev.date) {
      latest.set(s.dimensions.databaseId, {
        date: s.dimensions.date,
        size: s.max.databaseSizeBytes,
      });
    }
  }
  const values: Partial<Record<Metric, number>> = {
    pedidos_worker: account.workers.reduce((n, w) => n + w.sum.requests, 0),
    d1_linhas_lidas: account.d1.reduce((n, d) => n + d.sum.rowsRead, 0),
    d1_linhas_escritas: account.d1.reduce((n, d) => n + d.sum.rowsWritten, 0),
  };
  if (latest.size) {
    values.conta_armazenamento = [...latest.values()].reduce((n, d) => n + d.size, 0);
    const own = latest.get(opts.databaseId);
    if (own) values.d1_armazenamento = own.size;
  }
  return values;
}
