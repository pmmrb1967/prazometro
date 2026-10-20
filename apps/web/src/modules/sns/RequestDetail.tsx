import { buildIcs, formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { DateRecorder } from '../../components/DateRecorder';
import { LegalNotice } from '../../components/LegalNotice';
import { RuleSources } from '../../components/RuleSources';
import { db } from '../../db';
import { downloadBlob, slug } from '../../download';
import { Link, navigate, usePageHeading } from '../../router';
import { AREAS, EXAMS, PRIORITIES, TYPE_SHORT } from './labels';
import { P135_URL, P153_URL, SNS_RULES } from './rules';
import { WaitSummary } from './WaitSummary';
import { calendarEvents, tmrgText, waitStatus } from './waiting';

const LAE = 'https://lae.digital.gov.pt/';
const ERS_RECLAMAR = 'https://www.ers.pt/pt/reclamar-diretamente-ers/';
const SNS24 = 'https://www.sns24.gov.pt/';

export function RequestDetail({ id }: { id: string }) {
  const r = useLiveQuery(() => db.pedidos_sns.get(id), [id]);
  const heading = usePageHeading<HTMLHeadingElement>(r?.descricao ?? 'Pedido');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (r === undefined) return null;
  const today = todayInLisbon();
  const s = waitStatus(r, SNS_RULES, today);
  const inicio = r.data_indicacao ?? r.data_pedido;
  const waiting = !r.realizado_em;
  const canComplain = !!s.rule && (s.estado === 'ultrapassado' || s.marcadaDepois !== undefined);
  const hospital = r.tipo === 'consulta_hospitalar' || r.tipo === 'cirurgia';
  const letter = (template: string) => `/sns/${r.id}/carta/${template}`;

  function exportIcs() {
    downloadBlob(
      new Blob([buildIcs(calendarEvents(r!, s, today), { nome: `Prazómetro: ${r!.descricao}` })], {
        type: 'text/calendar',
      }),
      `prazometro-${slug(r!.descricao)}.ics`,
    );
  }

  async function remove() {
    await db.pedidos_sns.delete(r!.id);
    navigate('/sns', { replace: true });
  }

  const details = [
    TYPE_SHORT[r.tipo],
    r.exame && r.exame !== 'outro' ? EXAMS.find(([v]) => v === r.exame)?.[1] : undefined,
    r.area && r.area !== 'geral' ? AREAS.find(([v]) => v === r.area)?.[1] : undefined,
    r.prioridade ? `prioridade: ${PRIORITIES[r.prioridade].toLowerCase()}` : undefined,
    r.instituicao,
  ].filter(Boolean);

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/sns">Espera no SNS</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {r.descricao}
      </h1>
      <p className="lead">
        {details.join(' · ')}
        {inicio && ` · desde ${formatDateShort(inicio)}`}
        {r.data_marcada && ` · marcado para ${formatDateShort(r.data_marcada)}`}
      </p>

      <WaitSummary status={s} />

      {s.rule && (
        <p>
          <strong>Tempo máximo: {tmrgText(s.rule)}.</strong> {s.rule.descricao}
        </p>
      )}

      {s.estado === 'sem_prioridade' && (
        <section aria-labelledby="prioridades">
          <h2 id="prioridades">O tempo máximo depende da prioridade</h2>
          <ul className="timeline">
            {s.possibilidades.map((p) => (
              <li key={p.prioridade} className={p.prazo < today ? 'past' : undefined}>
                <strong>{PRIORITIES[p.prioridade]}</strong>: {tmrgText(p.rule)}, até{' '}
                {formatDateShort(p.prazo)}
                {p.prazo < today && ' (já passou)'}
              </li>
            ))}
          </ul>
          <p>
            Veja a prioridade na App SNS ou na área pessoal do{' '}
            <a href={SNS24} target="_blank" rel="noreferrer">
              SNS 24
            </a>
            , ou peça a informação por escrito com a carta abaixo. Depois, escolha «Alterar dados».
          </p>
        </section>
      )}

      {s.estado === 'sem_tmrg' && (
        <p className="notice">
          {r.tipo === 'exame'
            ? 'Para este exame, a portaria não fixa um tempo próprio: deve ser feito dentro do tempo previsto para o plano de cuidados em que se insere. Peça a informação por escrito com a carta abaixo.'
            : 'Para esta situação, a portaria não fixa um tempo máximo próprio. Peça a informação por escrito com a carta abaixo.'}
        </p>
      )}

      <section aria-labelledby="fazer">
        <h2 id="fazer">O que pode fazer</h2>
        <ol className="steps">
          <li>
            <h3>Pedir informação</h3>
            <p>
              Tem direito a saber a prioridade atribuída, o tempo máximo que se aplica e a sua
              posição na lista de espera. Pode ver isto na App SNS ou na área pessoal do SNS 24, ou
              pedir por escrito ao Gabinete do Cidadão.
            </p>
            <div className="actions">
              <Link to={letter('sns.pedido-informacao')} className="button">
                Carta: pedir informação
              </Link>
            </div>
          </li>

          {hospital && (
            <li>
              <h3>Ser atendido noutro hospital</h3>
              <p>
                Com o novo sistema de gestão das listas de espera (SINACC), quando há risco de não
                cumprir o tempo máximo, o pedido pode ser encaminhado para outro hospital ou
                entidade com vaga, com o seu acordo. Se recusar, mantém o lugar e a data de
                inscrição na lista. O sistema está a entrar em funcionamento por fases.
              </p>
            </li>
          )}

          <li>
            <h3>Reclamar</h3>
            {canComplain ? (
              <p>
                <strong>
                  {s.estado === 'ultrapassado'
                    ? 'O tempo máximo já passou.'
                    : 'A data marcada fica depois do tempo máximo.'}
                </strong>{' '}
                Pode reclamar por escrito ao Gabinete do Cidadão e pedir a marcação ou o
                encaminhamento para outra entidade.
              </p>
            ) : (
              <p>
                Se o tempo máximo passar sem ser atendido, ou se a data marcada ficar depois dele,
                pode reclamar. A app avisa quando for o caso.
              </p>
            )}
            {canComplain && (
              <div className="actions">
                <Link to={letter('sns.reclamacao')} className="button primary">
                  Carta: reclamação
                </Link>
              </div>
            )}
            <ul className="links">
              <li>
                No{' '}
                <a href={LAE} target="_blank" rel="noreferrer">
                  Livro Amarelo Eletrónico
                </a>{' '}
                (só alguns serviços públicos) ou no livro de reclamações em papel do hospital ou do
                centro de saúde.
              </li>
              <li>
                Diretamente na{' '}
                <a href={ERS_RECLAMAR} target="_blank" rel="noreferrer">
                  Entidade Reguladora da Saúde (ERS)
                </a>
                .
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <section aria-labelledby="atencao">
        <h2 id="atencao">Tenha em atenção</h2>
        <ul className="links">
          <li>
            Pode pedir para mudar a data marcada até duas vezes, com motivo justificado. Faltar sem
            justificação pode cancelar a inscrição na lista de espera.
          </li>
          <li>
            Mantenha o telefone e a morada atualizados no centro de saúde: se não o conseguirem
            contactar, a inscrição pode ser cancelada.
          </li>
          {r.tipo === 'cirurgia' && (
            <li>
              Se o médico suspender a inscrição por motivo clínico (pendência, até 3 meses), esse
              tempo não conta para a espera. A app não desconta esse período.
            </li>
          )}
        </ul>
      </section>

      {waiting && (
        <section aria-labelledby="atendido">
          <h2 id="atendido">Já foi atendido?</h2>
          <DateRecorder
            label="Em que dia teve a consulta, o exame ou a cirurgia?"
            onSave={(date) => db.pedidos_sns.update(r.id, { realizado_em: date })}
          />
        </section>
      )}
      {r.realizado_em && (
        <p>
          Atendido em {formatDateShort(r.realizado_em)}.{' '}
          <button
            type="button"
            onClick={() => db.pedidos_sns.update(r.id, { realizado_em: undefined })}
          >
            Ainda estou à espera
          </button>
        </p>
      )}

      <div className="actions">
        {calendarEvents(r, s, today).length > 0 && (
          <button type="button" onClick={exportIcs}>
            Pôr o lembrete no calendário
          </button>
        )}
        <Link to={`/sns/${r.id}/editar`} className="button">
          Alterar dados
        </Link>
      </div>

      {s.rule && <RuleSources rules={[s.rule]} />}
      <details className="sources">
        <summary>Os seus direitos e as regras das listas de espera</summary>
        <ul>
          <li>
            <a href={P153_URL} target="_blank" rel="noreferrer">
              Portaria n.º 153/2017 (versão consolidada)
            </a>
            : anexo III, Carta dos Direitos de Acesso aos Cuidados de Saúde pelos Utentes do SNS
            (direito ao cumprimento do tempo máximo, à informação e a reclamar).
          </li>
          <li>
            <a href={P135_URL} target="_blank" rel="noreferrer">
              Portaria n.º 135/2026/1, de 31 de março
            </a>
            : artigos 3.º (direitos e deveres), 10.º e 14.º (marcações e faltas), 15.º (pendência) e
            22.º (encaminhamento para outra entidade).
          </li>
        </ul>
        <p className="muted">Verificadas em 20/10/2026.</p>
      </details>

      <div className="danger-zone">
        {confirmDelete ? (
          <>
            <p>Apagar este pedido? Não é possível desfazer.</p>
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
            Apagar este pedido
          </button>
        )}
      </div>

      <LegalNotice />
    </>
  );
}
