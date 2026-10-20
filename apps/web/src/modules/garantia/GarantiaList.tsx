import { buildIcs, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { LegalNotice } from '../../components/LegalNotice';
import { db } from '../../db';
import { downloadBlob } from '../../download';
import { Link, usePageHeading } from '../../router';
import { BackupPanel } from './BackupPanel';
import { GARANTIA_RULES } from './rules';
import { StatusSummary } from './StatusSummary';
import { calendarEvents, warrantyStatus } from './warranty';

export function GarantiaList() {
  const heading = usePageHeading<HTMLHeadingElement>('Garantias');
  const compras = useLiveQuery(() => db.compras.orderBy('data_entrega').reverse().toArray());
  const today = todayInLisbon();
  const items = (compras ?? []).map((p) => ({ p, s: warrantyStatus(p, GARANTIA_RULES, today) }));

  function exportAll() {
    const events = items.flatMap(({ p, s }) => calendarEvents(p, s, today));
    downloadBlob(
      new Blob([buildIcs(events, { nome: 'Prazómetro: garantias' })], { type: 'text/calendar' }),
      'prazometro-garantias.ics',
    );
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Garantias das suas compras
      </h1>
      <p className="lead">
        Registe o que comprou e veja até quando a loja responde por defeitos. A garantia legal é de
        3 anos a contar da entrega.
      </p>

      <div className="actions">
        <Link to="/garantia/nova" className="button primary">
          Registar uma compra
        </Link>
        {items.length > 0 && (
          <button type="button" onClick={exportAll}>
            Pôr os lembretes no calendário
          </button>
        )}
      </div>

      {compras === undefined ? null : items.length === 0 ? (
        <p className="empty">
          Ainda não registou nenhuma compra. Comece por uma que tenha feito nos últimos 3 anos, por
          exemplo um eletrodoméstico ou um telemóvel.
        </p>
      ) : (
        <ul className="cards">
          {items.map(({ p, s }) => (
            <li key={p.id}>
              <Link to={`/garantia/${p.id}`} className="card-link">
                <span className="card-title">{p.produto}</span>
                <span className="muted">{p.loja}</span>
              </Link>
              <StatusSummary status={s} />
            </li>
          ))}
        </ul>
      )}

      <BackupPanel />
      <LegalNotice />
    </>
  );
}
