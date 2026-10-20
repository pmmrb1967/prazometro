import { buildIcs, formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { LegalNotice } from '../../components/LegalNotice';
import { RuleSources } from '../../components/RuleSources';
import { db } from '../../db';
import { downloadBlob, slug } from '../../download';
import { Link, navigate, usePageHeading } from '../../router';
import { GARANTIA_RULES } from './rules';
import { StatusSummary } from './StatusSummary';
import { calendarEvents, warrantyStatus } from './warranty';

const STATE_LABEL = { novo: 'Novo', recondicionado: 'Recondicionado', usado: 'Usado' };

function useObjectUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

export function PurchaseDetail({ id }: { id: string }) {
  const p = useLiveQuery(() => db.compras.get(id), [id]);
  const fatura = useLiveQuery(
    () => (p?.fatura_id ? db.ficheiros.get(p.fatura_id) : undefined),
    [p?.fatura_id],
  );
  const faturaUrl = useObjectUrl(fatura?.blob);
  const heading = usePageHeading<HTMLHeadingElement>(p?.produto ?? 'Compra');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (p === undefined) return null;
  const today = todayInLisbon();
  const s = warrantyStatus(p, GARANTIA_RULES, today);

  function exportIcs() {
    const events = calendarEvents(p!, s, today);
    downloadBlob(
      new Blob([buildIcs(events, { nome: `Prazómetro: ${p!.produto}` })], {
        type: 'text/calendar',
      }),
      `prazometro-${slug(p!.produto)}.ics`,
    );
  }

  async function remove() {
    if (p!.fatura_id) await db.ficheiros.delete(p!.fatura_id);
    await db.compras.delete(p!.id);
    navigate('/garantia', { replace: true });
  }

  const usedRules = [...(s.principal ? [s.principal] : []), ...s.aposComunicacao].map(
    (e) => e.rule,
  );

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/garantia">Garantias</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {p.produto}
      </h1>
      <p className="lead">
        {p.loja} · {STATE_LABEL[p.estado]} · recebido em {formatDateShort(p.data_entrega)}
      </p>

      <StatusSummary status={s} />

      {s.principal && (
        <section aria-labelledby="datas">
          <h2 id="datas">Datas importantes</h2>
          <ul className="timeline">
            {s.principal.result.marcos.map((m) => (
              <li key={m.id} className={m.data < today ? 'past' : undefined}>
                <strong>{formatDateShort(m.data)}</strong>
                {m.data < today && <span className="muted"> (já passou)</span>}
                <p>{m.texto}</p>
              </li>
            ))}
            <li className={s.fim! < today ? 'past' : undefined}>
              <strong>{formatDateShort(s.fim!)}</strong>
              <p>Último dia da garantia legal. {s.principal.rule.descricao}</p>
            </li>
          </ul>
        </section>
      )}

      {s.aposComunicacao.length > 0 && (
        <section aria-labelledby="reclamacao">
          <h2 id="reclamacao">Depois de comunicar o defeito</h2>
          <p>Comunicou o defeito à loja em {formatDateShort(p.data_comunicacao!)}.</p>
          <ul className="timeline">
            {s.aposComunicacao.map(({ rule, result }) => (
              <li key={rule.id}>
                <strong>{formatDateShort(result.prazo!)}</strong>: {rule.titulo}
                <p>{rule.descricao}</p>
              </li>
            ))}
          </ul>
          <p className="hint">
            Enquanto o bem está a ser reparado, o prazo da garantia fica parado, e cada reparação
            acrescenta 6 meses de garantia. A app ainda não soma esse tempo: as datas mostradas são
            as mais cedo possíveis.
          </p>
        </section>
      )}

      <div className="actions">
        {s.estado !== 'nao_coberta' && (
          <Link to={`/garantia/${p.id}/reclamar`} className="button primary">
            Tenho um problema com este bem
          </Link>
        )}
        {s.principal && (
          <button type="button" onClick={exportIcs}>
            Pôr os lembretes no calendário
          </button>
        )}
        <Link to={`/garantia/${p.id}/editar`} className="button">
          Alterar dados
        </Link>
      </div>

      {(faturaUrl || p.preco !== undefined || p.notas) && (
        <section aria-labelledby="detalhes">
          <h2 id="detalhes">Detalhes</h2>
          {p.preco !== undefined && (
            <p>Preço: {p.preco.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
          )}
          {faturaUrl && (
            <p>
              <a href={faturaUrl} target="_blank" rel="noreferrer">
                Ver a fatura guardada
              </a>
            </p>
          )}
          {p.notas && <p className="notes">{p.notas}</p>}
        </section>
      )}

      {usedRules.length > 0 && <RuleSources rules={usedRules} />}

      <div className="danger-zone">
        {confirmDelete ? (
          <>
            <p>Apagar esta compra e a fatura guardada? Não é possível desfazer.</p>
            <div className="actions">
              <button type="button" className="danger" onClick={remove}>
                Sim, apagar
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                Não apagar
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}>
            Apagar esta compra
          </button>
        )}
      </div>

      <LegalNotice />
    </>
  );
}
