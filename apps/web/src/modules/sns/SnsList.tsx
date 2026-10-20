import { buildIcs, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { BackupPanel } from '../../components/BackupPanel';
import { LegalNotice } from '../../components/LegalNotice';
import { db } from '../../db';
import { downloadBlob } from '../../download';
import { Link, usePageHeading } from '../../router';
import { TYPE_SHORT } from './labels';
import { SNS_RULES } from './rules';
import { WaitSummary } from './WaitSummary';
import { calendarEvents, waitStatus } from './waiting';

export function SnsList() {
  const heading = usePageHeading<HTMLHeadingElement>('Espera no SNS');
  const pedidos = useLiveQuery(() => db.pedidos_sns.orderBy('criado_em').reverse().toArray());
  const today = todayInLisbon();
  const items = (pedidos ?? []).map((r) => ({ r, s: waitStatus(r, SNS_RULES, today) }));

  function exportAll() {
    const events = items.flatMap(({ r, s }) => calendarEvents(r, s, today));
    downloadBlob(
      new Blob([buildIcs(events, { nome: 'Prazómetro: espera no SNS' })], {
        type: 'text/calendar',
      }),
      'prazometro-sns.ics',
    );
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Espera no SNS
      </h1>
      <p className="lead">
        Há tempos máximos para consultas, exames e cirurgias no SNS. Registe o que está à espera e
        veja se o tempo máximo já passou.
      </p>

      <div className="actions">
        <Link to="/sns/novo" className="button primary">
          Registar um pedido
        </Link>
        {items.some(({ r, s }) => calendarEvents(r, s, today).length > 0) && (
          <button type="button" onClick={exportAll}>
            Pôr os lembretes no calendário
          </button>
        )}
      </div>

      {pedidos === undefined ? null : items.length === 0 ? (
        <p className="empty">
          Ainda não registou nenhum pedido. Pode ser uma consulta no centro de saúde, uma primeira
          consulta no hospital, um exame ou uma cirurgia.
        </p>
      ) : (
        <ul className="cards">
          {items.map(({ r, s }) => (
            <li key={r.id}>
              <Link to={`/sns/${r.id}`} className="card-link">
                <span className="card-title">{r.descricao}</span>
                <span className="muted">
                  {TYPE_SHORT[r.tipo]}
                  {r.instituicao ? ` · ${r.instituicao}` : ''}
                </span>
              </Link>
              <WaitSummary status={s} />
            </li>
          ))}
        </ul>
      )}

      <BackupPanel />
      <LegalNotice />
    </>
  );
}
