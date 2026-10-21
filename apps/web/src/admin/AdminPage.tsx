import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../cloud/api';
import { Link, usePageHeading } from '../router';

// Painel de admin: uso do plano gratuito nos últimos 30 dias, alertas, modo poupança e relatos
// de regras desatualizadas. Os dados vêm do Worker monitor (de hora a hora).

type MetricInfo = {
  rotulo: string;
  unidade: 'numero' | 'bytes';
  limite?: number;
  diario?: boolean;
};

type Usage = {
  desde: string;
  hoje: string;
  metricas: Record<string, MetricInfo>;
  uso: { date: string; metric: string; value: number; updated_at: number }[];
  alertas: { date: string; metric: string; threshold: number; value: number; sent_at: number }[];
  modo_poupanca: { ate: number; motivo: string[] } | null;
  relatos_novos: number;
};

type Report = {
  id: string;
  rule_id: string;
  message: string;
  created_at: number;
  status: Status;
  updated_at: number | null;
};

const STATUS_LABEL = {
  novo: 'Novo',
  em_analise: 'Em análise',
  resolvido: 'Resolvido',
  rejeitado: 'Rejeitado',
} as const;
type Status = keyof typeof STATUS_LABEL;

const num = new Intl.NumberFormat('pt-PT');

function formatValue(v: number, unit: MetricInfo['unidade']) {
  if (unit === 'numero') return num.format(Math.round(v));
  if (v < 1024 * 1024) return `${num.format(Math.round(v / 1024))} KB`;
  if (v < 1024 ** 3)
    return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(v / 1024 ** 2)} MB`;
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(v / 1024 ** 3)} GB`;
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

const when = (s: number) =>
  new Date(s * 1000).toLocaleString('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Lisbon',
  });

function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400_000)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Estado em texto (nunca só pela cor): normal, atenção (70%) ou crítico (90%). */
function level(pct: number) {
  if (pct >= 90) return { label: 'Crítico', className: 'level-critico' };
  if (pct >= 70) return { label: 'Atenção', className: 'level-atencao' };
  return { label: 'Normal', className: 'level-normal' };
}

/** Barras por dia, uma série: o título do cartão diz o que é, sem legenda. */
function DailyBars({
  dates,
  values,
  info,
}: {
  dates: string[];
  values: (number | undefined)[];
  info: MetricInfo;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300;
  const H = 96;
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  // A linha do limite só aparece quando o uso chega perto (senão achataria as barras).
  const showLimit = info.limite !== undefined && max >= info.limite * 0.5;
  const top = showLimit ? Math.max(max, info.limite!) * 1.05 : max * 1.1;
  const step = W / dates.length;
  const barW = Math.max(2, step - 2);
  const y = (v: number) => H - (v / top) * H;
  const hovered = hover !== null ? { date: dates[hover]!, value: values[hover] } : null;

  return (
    <figure className="chart">
      <p className="chart-tip" aria-hidden="true">
        {hovered
          ? `${dayLabel(hovered.date)}: ${hovered.value === undefined ? 'sem dados' : formatValue(hovered.value, info.unidade)}`
          : ' '}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${info.rotulo}, últimos ${dates.length} dias. Valores na tabela abaixo.`}
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="chart-axis" />
        {values.map((v, i) =>
          v === undefined ? null : (
            <rect
              key={dates[i]}
              x={i * step + 1}
              y={Math.min(y(v), H - 1)}
              width={barW}
              height={Math.max(1, H - y(v))}
              rx="1.5"
              className={hover === i ? 'chart-bar active' : 'chart-bar'}
            />
          ),
        )}
        {showLimit && (
          <line x1="0" x2={W} y1={y(info.limite!)} y2={y(info.limite!)} className="chart-limit" />
        )}
        {/* Zonas de hover maiores do que as barras. */}
        {dates.map((d, i) => (
          <rect
            key={d}
            x={i * step}
            y="0"
            width={step}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      <figcaption className="chart-x">
        <span>{dayLabel(dates[0]!)}</span>
        {showLimit && (
          <span className="chart-limit-label">
            - - limite {formatValue(info.limite!, info.unidade)}
          </span>
        )}
        <span>{dayLabel(dates[dates.length - 1]!)}</span>
      </figcaption>
    </figure>
  );
}

function ReportsList() {
  const [filter, setFilter] = useState<Status | ''>('novo');
  const [reports, setReports] = useState<Report[]>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    api<{ relatos: Report[] }>(`/admin/reports${filter ? `?estado=${filter}` : ''}`).then(
      (r) => alive && setReports(r.relatos),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [filter, version]);

  async function change(id: string, status: Status) {
    try {
      await api(`/admin/reports/${id}`, { method: 'PATCH', json: { status } });
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section aria-labelledby="relatos">
      <h2 id="relatos">Relatos de regras e opiniões</h2>
      <label className="field">
        Mostrar
        <select value={filter} onChange={(e) => setFilter(e.target.value as Status | '')}>
          <option value="">Todos</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="errors">{error}</p>}
      {reports?.length === 0 && <p>Não há relatos.</p>}
      <ul className="reports">
        {reports?.map((r) => (
          <li key={r.id}>
            <p>
              <strong>
                {r.rule_id.startsWith('opiniao.') ? `Opinião: ${r.rule_id.slice(8)}` : r.rule_id}
              </strong>{' '}
              <span className="muted">· {when(r.created_at)}</span>
            </p>
            <p className="report-message">{r.message}</p>
            <label className="field">
              Estado
              <select value={r.status} onChange={(e) => change(r.id, e.target.value as Status)}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminPage() {
  const heading = usePageHeading<HTMLHeadingElement>('Painel de admin');
  const [usage, setUsage] = useState<Usage>();
  const [error, setError] = useState<{ status: number; message: string }>();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    api<Usage>('/admin/usage?dias=30').then(
      (u) => alive && setUsage(u),
      (e: unknown) =>
        alive &&
        setError(
          e instanceof ApiError
            ? { status: e.status, message: e.message }
            : { status: 0, message: String(e) },
        ),
    );
    return () => {
      alive = false;
    };
  }, [version]);

  async function stopSavings() {
    await api('/admin/savings', { method: 'DELETE' });
    refresh();
  }

  let body;
  if (error) {
    body =
      error.status === 401 ? (
        <p>
          Entre primeiro na sua conta em <Link to="/copia">Cópia na nuvem</Link>, com a passkey.
        </p>
      ) : (
        <p className="errors">{error.message}</p>
      );
  } else if (!usage) {
    body = <p>A carregar…</p>;
  } else {
    const dates = datesBetween(usage.desde, usage.hoje);
    const byMetric = new Map<string, Map<string, number>>();
    let updated = 0;
    for (const u of usage.uso) {
      if (!byMetric.has(u.metric)) byMetric.set(u.metric, new Map());
      byMetric.get(u.metric)!.set(u.date, u.value);
      updated = Math.max(updated, u.updated_at);
    }
    const metrics = Object.entries(usage.metricas);
    body = (
      <>
        <p className="muted">
          Dias em UTC (os limites da Cloudflare reiniciam às 00:00 UTC).{' '}
          {updated
            ? `Última leitura do monitor: ${when(updated)}.`
            : 'O monitor ainda não gravou dados.'}
        </p>
        {usage.modo_poupanca && (
          <div className="notice" role="status">
            <p>
              <strong>Modo poupança ligado</strong> até {when(usage.modo_poupanca.ate)}, por causa
              de: {usage.modo_poupanca.motivo.map((m) => usage.metricas[m]?.rotulo ?? m).join(', ')}
              . As cópias na nuvem estão em pausa.
            </p>
            <button type="button" onClick={stopSavings}>
              Desligar agora
            </button>
          </div>
        )}
        <ul className="metric-cards">
          {metrics.map(([id, info]) => {
            const series = byMetric.get(id);
            const today = series?.get(usage.hoje);
            const pct =
              info.limite && today !== undefined ? (today / info.limite) * 100 : undefined;
            const lv = pct !== undefined ? level(pct) : null;
            return (
              <li key={id} className="metric-card">
                <h3>{info.rotulo}</h3>
                <p className="metric-value">
                  {today === undefined ? '—' : formatValue(today, info.unidade)}
                </p>
                {info.limite && (
                  <p className="metric-limit">
                    {lv && <span className={`level ${lv.className}`}>{lv.label}</span>}{' '}
                    {pct !== undefined && `${num.format(Math.round(pct * 10) / 10)}% de `}
                    {formatValue(info.limite, info.unidade)}
                    {info.diario ? ' por dia' : ''}
                  </p>
                )}
                <DailyBars dates={dates} values={dates.map((d) => series?.get(d))} info={info} />
              </li>
            );
          })}
        </ul>
        <details className="sources">
          <summary>Ver os valores em tabela</summary>
          <div className="table-scroll">
            <table className="usage-table">
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  {metrics.map(([id, info]) => (
                    <th key={id} scope="col">
                      {info.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...dates].reverse().map((d) => (
                  <tr key={d}>
                    <th scope="row">{d}</th>
                    {metrics.map(([id, info]) => {
                      const v = byMetric.get(id)?.get(d);
                      return (
                        <td key={id}>{v === undefined ? '—' : formatValue(v, info.unidade)}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <section aria-labelledby="alertas">
          <h2 id="alertas">Alertas</h2>
          {usage.alertas.length === 0 ? (
            <p>Sem alertas nos últimos 30 dias.</p>
          ) : (
            <ul className="alerts">
              {usage.alertas.map((a) => (
                <li key={`${a.date}-${a.metric}-${a.threshold}`}>
                  <strong>{a.date}</strong>:{' '}
                  {a.metric === 'monitor'
                    ? 'o monitor não conseguiu ler as estatísticas da Cloudflare (ver o token).'
                    : `${usage.metricas[a.metric]?.rotulo ?? a.metric} chegou a ${a.threshold}% (${formatValue(a.value, usage.metricas[a.metric]?.unidade ?? 'numero')}).`}
                </li>
              ))}
            </ul>
          )}
        </section>

        <ReportsList />
      </>
    );
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Painel de admin
      </h1>
      {body}
    </>
  );
}
