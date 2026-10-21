import { ISSUER_LABELS, LETTER_TYPE_LABELS, LETTER_TYPES, type LetterType } from '@prazometro/ai';
import { buildIcs, formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { LegalNotice } from '../../components/LegalNotice';
import { RuleSources } from '../../components/RuleSources';
import { db } from '../../db';
import { downloadBlob, slug } from '../../download';
import { Link, navigate, usePageHeading } from '../../router';
import { PROVIDER_LABELS } from './aiConfig';
import { DeadlineSummary } from './DeadlineSummary';
import { GUIDANCE } from './guidance';
import { hasRule, letterDeadline } from './rules';

export function LetterDetail({ id }: { id: string }) {
  const c = useLiveQuery(() => db.cartas.get(id), [id]);
  const heading = usePageHeading<HTMLHeadingElement>(
    c ? c.assunto || LETTER_TYPE_LABELS[c.tipo] : 'Carta',
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aviso] = useState(() => new URLSearchParams(location.search).get('aviso'));

  if (c === undefined) return null;
  const today = todayInLisbon();
  const deadline = letterDeadline(c, today);
  const guidance = GUIDANCE[c.tipo];
  const title = c.assunto || LETTER_TYPE_LABELS[c.tipo];
  const update = (changes: Partial<typeof c>) => db.cartas.update(c.id, changes);

  function exportIcs() {
    const prazo = deadline!.result.prazo!;
    downloadBlob(
      new Blob(
        [
          buildIcs(
            [
              {
                uid: `carta-${c!.id}@prazometro`,
                data: prazo,
                titulo: `Prazo: ${title}`,
                descricao: deadline!.rule.descricao,
                alarmes_dias_antes: deadline!.rule.prazo.alertas_dias_antes,
              },
            ],
            { nome: `Prazómetro: ${title}` },
          ),
        ],
        { type: 'text/calendar' },
      ),
      `prazometro-${slug(title)}.ics`,
    );
  }

  async function remove() {
    await db.cartas.delete(c!.id);
    navigate('/cartas', { replace: true });
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/cartas">Perceber uma carta</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <p className="lead">
        {c.emissor_nome || ISSUER_LABELS[c.emissor]}
        {c.data_carta && ` · carta de ${formatDateShort(c.data_carta)}`}
      </p>

      {aviso && <p className="notice">{aviso}</p>}

      <DeadlineSummary letter={c} deadline={deadline} today={today} />

      <section aria-labelledby="resumo">
        <h2 id="resumo">O que diz a carta</h2>
        <dl className="letter-facts">
          <dt>Quem enviou</dt>
          <dd>
            {ISSUER_LABELS[c.emissor]}
            {c.emissor_nome &&
              c.emissor_nome !== ISSUER_LABELS[c.emissor] &&
              ` (${c.emissor_nome})`}
          </dd>
          <dt>Em resumo</dt>
          <dd>{c.resumo}</dd>
          <dt>O que pede</dt>
          <dd>{c.pedido}</dd>
          {c.consequencias && (
            <>
              <dt>Se não fizer nada</dt>
              <dd>{c.consequencias}</dd>
            </>
          )}
        </dl>
        <p className="hint">
          Lido com: {PROVIDER_LABELS[c.fornecedor]}. A leitura pode ter erros: confirme sempre na
          carta original.
        </p>
      </section>

      <section aria-labelledby="prazo">
        <h2 id="prazo">Até quando</h2>
        {deadline?.result.prazo ? (
          <>
            <p>
              <strong>{formatDateShort(deadline.result.prazo)}</strong>, calculado pelo Prazómetro a
              partir de {formatDateShort(deadline.inicio)}. {deadline.rule.descricao}
            </p>
            {deadline.rule.notas && <p className="muted">{deadline.rule.notas}</p>}
          </>
        ) : hasRule(c.tipo) ? (
          <p>Indique abaixo a data da carta ou o dia em que a recebeu para calcular o prazo.</p>
        ) : (
          <p>
            Para este tipo de carta, o Prazómetro ainda não calcula o prazo. Veja na carta se há uma
            data limite.
          </p>
        )}

        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            Tipo de carta
            <span className="hint">Confirme se a leitura acertou. O prazo depende do tipo.</span>
            <select value={c.tipo} onChange={(e) => update({ tipo: e.target.value as LetterType })}>
              {LETTER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LETTER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Data da carta
            <input
              type="date"
              value={c.data_carta ?? ''}
              max={today}
              onChange={(e) => update({ data_carta: e.target.value || undefined })}
            />
          </label>
          <label className="field">
            Dia em que recebeu a carta
            <span className="hint">
              O prazo conta a partir da data mais cedo das duas. Se tiver dúvidas, conte com a data
              mais cedo.
            </span>
            <input
              type="date"
              value={c.data_rececao ?? ''}
              max={today}
              onChange={(e) => update({ data_rececao: e.target.value || undefined })}
            />
          </label>
        </form>
      </section>

      <section aria-labelledby="fazer">
        <h2 id="fazer">O que pode fazer</h2>
        <ol className="steps">
          {guidance.passos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        {guidance.ajuda && (
          <p>
            <a href={guidance.ajuda.url} target="_blank" rel="noreferrer">
              {guidance.ajuda.texto}
            </a>
          </p>
        )}
      </section>

      {c.datas.length > 0 && (
        <section aria-labelledby="datas">
          <h2 id="datas">Datas escritas na carta</h2>
          <ul className="timeline">
            {c.datas.map((d) => (
              <li key={d.data + d.descricao}>
                <strong>{formatDateShort(d.data)}</strong>: {d.descricao}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="actions">
        {deadline?.result.prazo && !c.tratada_em && (
          <button type="button" onClick={exportIcs}>
            Pôr o lembrete no calendário
          </button>
        )}
        {c.tratada_em ? (
          <button type="button" onClick={() => update({ tratada_em: undefined })}>
            Ainda não tratei
          </button>
        ) : (
          <button type="button" onClick={() => update({ tratada_em: today })}>
            Já tratei deste assunto
          </button>
        )}
      </div>

      <details className="sources">
        <summary>Texto da carta</summary>
        <pre className="anonymized">{c.texto}</pre>
      </details>
      {deadline && <RuleSources rules={[deadline.rule]} />}

      <div className="danger-zone">
        {confirmDelete ? (
          <>
            <p>Apagar esta carta? Não é possível desfazer.</p>
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
            Apagar esta carta
          </button>
        )}
      </div>

      <LegalNotice />
    </>
  );
}
