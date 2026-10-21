import { buildIcs, formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { LegalNotice } from '../../components/LegalNotice';
import { RuleSources } from '../../components/RuleSources';
import { db, type DeathProcess, type StepState } from '../../db';
import { downloadBlob } from '../../download';
import { TEMPLATES } from '../../letters';
import { Link, navigate, usePageHeading } from '../../router';
import { Inventory } from './Inventory';
import { DevelopmentBanner } from './DevelopmentBanner';
import { calendarEvents, nextDeadline, progress, stepViews, type StepView } from './process';
import { POS_OBITO_RULES } from './rules';
import { PHASES } from './steps';

const days = (n: number) => (n === 1 ? '1 dia' : `${n} dias`);

export function ProcessDetail({ id }: { id: string }) {
  const p = useLiveQuery(() => db.processos_obito.get(id), [id], null);
  if (p === null) return null;
  if (!p) {
    return (
      <p>
        Processo não encontrado. <Link to="/pos-obito">Voltar</Link>
      </p>
    );
  }
  return <Detail p={p} />;
}

function Detail({ p }: { p: DeathProcess }) {
  const title = p.nome || 'Falecimento';
  const heading = usePageHeading<HTMLHeadingElement>(title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = todayInLisbon();
  const views = stepViews(p, POS_OBITO_RULES, today);
  const next = nextDeadline(views);
  const { feitos, total } = progress(views);
  const events = calendarEvents(p, views, today);

  async function setState(stepId: string, estado: StepState) {
    await db.processos_obito.update(p.id, {
      passos: { ...p.passos, [stepId]: { estado, atualizado_em: today } },
    });
  }

  function exportIcs() {
    downloadBlob(
      new Blob([buildIcs(events, { nome: 'Prazómetro: depois de um falecimento' })], {
        type: 'text/calendar',
      }),
      'prazometro-pos-obito.ics',
    );
  }

  async function remove() {
    await db.processos_obito.delete(p.id);
    navigate('/pos-obito', { replace: true });
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/pos-obito">Depois de um falecimento</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <DevelopmentBanner />
      <p className="muted">
        Óbito a {formatDateShort(p.data_obito)}
        {p.data_registo_obito && `, registado a ${formatDateShort(p.data_registo_obito)}`}. {feitos}{' '}
        de {total} passos tratados.
      </p>

      {next ? (
        <div className={`status status-${next.faltam! <= 7 ? 'a_terminar' : 'ativa'}`}>
          <p className="status-label">Próximo prazo: {next.step.titulo}</p>
          <p className="status-date">
            Até <strong>{formatDateShort(next.prazo!)}</strong>.{' '}
            {next.faltam === 0 ? 'Hoje é o último dia.' : `Faltam ${days(next.faltam!)}.`}
          </p>
        </div>
      ) : (
        <div className="status status-terminada">
          <p className="status-label">Não há prazos a correr nos passos por fazer.</p>
        </div>
      )}

      <div className="actions">
        {events.length > 0 && (
          <button type="button" onClick={exportIcs}>
            Pôr os prazos no calendário
          </button>
        )}
        <Link to={`/pos-obito/${p.id}/editar`} className="button">
          Alterar datas ou nome
        </Link>
      </div>

      {PHASES.map(([phase, label]) => {
        const items = views.filter((v) => v.step.fase === phase);
        if (items.length === 0) return null;
        return (
          <section key={phase} aria-labelledby={`fase-${phase}`}>
            <h2 id={`fase-${phase}`}>{label}</h2>
            <ul className="cards">
              {items.map((v) => (
                <StepCard key={v.step.id} v={v} processId={p.id} onState={setState} />
              ))}
            </ul>
          </section>
        );
      })}

      <Inventory p={p} />

      <RuleSources rules={POS_OBITO_RULES} />

      <section aria-labelledby="apagar">
        <h2 id="apagar">Apagar</h2>
        {confirmDelete ? (
          <div className="actions">
            <p>Apagar este processo e o inventário deste dispositivo?</p>
            <button type="button" className="danger" onClick={remove}>
              Sim, apagar
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Não
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}>
            Apagar este processo
          </button>
        )}
      </section>

      <LegalNotice />
    </>
  );
}

function StepCard({
  v,
  processId,
  onState,
}: {
  v: StepView;
  processId: string;
  onState: (stepId: string, estado: StepState) => void;
}) {
  const { step, estado, prazo, faltam } = v;
  const headingId = `passo-${step.id}`;
  return (
    <li className={`step-card step-${estado}`} aria-labelledby={headingId}>
      <h3 id={headingId}>
        {step.titulo}
        {estado === 'feito' && <span className="tag">Tratado</span>}
        {estado === 'nao_aplica' && <span className="tag">Não se aplica</span>}
      </h3>
      {prazo && estado === 'por_fazer' && (
        <p className={faltam! < 0 ? 'deadline-past' : 'deadline'}>
          {faltam! < 0 ? (
            <>
              O prazo terminou a <strong>{formatDateShort(prazo)}</strong>. Mesmo assim, informe-se:
              pode ainda ser possível tratar.
            </>
          ) : (
            <>
              Prazo: até <strong>{formatDateShort(prazo)}</strong>
              {faltam === 0 ? ' (hoje).' : ` (faltam ${days(faltam!)}).`}
            </>
          )}
        </p>
      )}
      {estado === 'por_fazer' && (
        <>
          {step.texto.map((t) => (
            <p key={t}>{t}</p>
          ))}
          {step.custo && (
            <p>
              <strong>Custo:</strong> {step.custo}
            </p>
          )}
          {(step.cartas?.length ?? 0) > 0 && (
            <ul className="links">
              {step.cartas!.map((c) => (
                <li key={c}>
                  <Link to={`/pos-obito/${processId}/carta/${c}`}>
                    Carta: {TEMPLATES[c]?.meta.titulo ?? c}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {step.ligacoes.length > 0 && (
            <ul className="links">
              {step.ligacoes.map((l) => (
                <li key={l.url + l.titulo}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.titulo}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="actions">
        {estado === 'por_fazer' ? (
          <>
            <button type="button" onClick={() => onState(step.id, 'feito')}>
              Já tratei
            </button>
            <button type="button" onClick={() => onState(step.id, 'nao_aplica')}>
              Não se aplica
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onState(step.id, 'por_fazer')}>
            Voltar a pôr por fazer
          </button>
        )}
      </div>
    </li>
  );
}
