import { LETTER_TYPE_LABELS } from '@prazometro/ai';
import { formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { LegalNotice } from '../components/LegalNotice';
import { db, type ReceivedShare } from '../db';
import { DeadlineSummary } from '../modules/cartas/DeadlineSummary';
import { letterDeadline } from '../modules/cartas/rules';
import { GARANTIA_RULES } from '../modules/garantia/rules';
import { StatusSummary } from '../modules/garantia/StatusSummary';
import { warrantyStatus } from '../modules/garantia/warranty';
import { nextDeadline, progress, stepViews } from '../modules/pos-obito/process';
import { POS_OBITO_RULES } from '../modules/pos-obito/rules';
import { SNS_RULES } from '../modules/sns/rules';
import { WaitSummary } from '../modules/sns/WaitSummary';
import { waitStatus } from '../modules/sns/waiting';
import { Link, navigate, usePageHeading } from '../router';
import { refreshReceived, SCOPE_LABELS } from './shares';

const title = (r: ReceivedShare) => `${SCOPE_LABELS[r.ambito]}${r.de ? ` de ${r.de}` : ''}`;

export function ReceivedList() {
  const heading = usePageHeading<HTMLHeadingElement>('Partilhas que recebeu');
  const list = useLiveQuery(() => db.partilhas_recebidas.orderBy('recebida_em').toArray());
  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Partilhas que recebeu
      </h1>
      {list === undefined ? null : list.length === 0 ? (
        <p className="empty">
          Ainda não recebeu nenhuma partilha. Quando alguém lhe enviar uma ligação do Prazómetro,
          abra-a neste telemóvel.
        </p>
      ) : (
        <ul className="cards">
          {list.map((r) => (
            <li key={r.id}>
              <Link to={`/partilhas/${r.id}`} className="card-link">
                <span className="card-title">{title(r)}</span>
                <span className="muted">
                  {r.estado === 'retirada'
                    ? 'Acesso retirado'
                    : r.atualizada_em
                      ? `Atualizada a ${formatDateShort(r.atualizada_em.slice(0, 10))}`
                      : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link to="/partilhar">Partilhar os meus prazos com a família</Link>
      </p>
    </>
  );
}

export function ReceivedView({ id }: { id: string }) {
  const r = useLiveQuery(() => db.partilhas_recebidas.get(id), [id], null);
  if (r === null) return null;
  if (!r) {
    return (
      <p>
        Partilha não encontrada. <Link to="/partilhas">Voltar</Link>
      </p>
    );
  }
  return <View r={r} />;
}

function View({ r }: { r: ReceivedShare }) {
  const heading = usePageHeading<HTMLHeadingElement>(title(r));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const today = todayInLisbon();
  const d = r.dados ?? {};

  async function refresh() {
    setBusy(true);
    setError(undefined);
    try {
      await refreshReceived(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await db.partilhas_recebidas.delete(r.id);
    navigate('/partilhas', { replace: true });
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/partilhas">Partilhas que recebeu</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {title(r)}
      </h1>

      {r.estado === 'retirada' ? (
        <p className="notice">
          A pessoa que partilhou retirou o acesso. Os dados desta partilha foram apagados deste
          dispositivo.
        </p>
      ) : (
        <>
          <p className="muted">
            Só de leitura.{' '}
            {r.atualizada_em && `Atualizada a ${formatDateShort(r.atualizada_em.slice(0, 10))}. `}
            Atualiza sempre que abre a app.
          </p>
          <div className="actions">
            <button type="button" onClick={refresh} disabled={busy}>
              {busy ? 'A atualizar…' : 'Atualizar agora'}
            </button>
          </div>
          {error && (
            <p className="errors" role="alert">
              {error}
            </p>
          )}

          <ul className="cards">
            {d.compras?.map((p) => (
              <li key={p.id}>
                <p className="card-title">{p.produto}</p>
                <p className="muted">{p.loja}</p>
                <StatusSummary status={warrantyStatus(p, GARANTIA_RULES, today)} />
              </li>
            ))}
            {d.pedidos_sns?.map((p) => (
              <li key={p.id}>
                <p className="card-title">{p.descricao}</p>
                {p.instituicao && <p className="muted">{p.instituicao}</p>}
                <WaitSummary status={waitStatus(p, SNS_RULES, today)} />
              </li>
            ))}
            {d.cartas?.map((c) => (
              <li key={c.id}>
                <p className="card-title">{c.assunto || LETTER_TYPE_LABELS[c.tipo]}</p>
                <p>{c.resumo}</p>
                <DeadlineSummary letter={c} deadline={letterDeadline(c, today)} today={today} />
              </li>
            ))}
            {d.processos_obito?.map((p) => {
              const views = stepViews(p, POS_OBITO_RULES, today);
              const next = nextDeadline(views);
              const { feitos, total } = progress(views);
              return (
                <li key={p.id}>
                  <p className="card-title">{p.nome || 'Falecimento'}</p>
                  <p className="muted">
                    Óbito a {formatDateShort(p.data_obito)} · {feitos} de {total} passos tratados
                  </p>
                  {next && (
                    <p>
                      Próximo prazo: <strong>{next.step.titulo}</strong>, até{' '}
                      {formatDateShort(next.prazo!)}.
                    </p>
                  )}
                  <ul>
                    {views.map((v) => (
                      <li key={v.step.id}>
                        {v.step.titulo}:{' '}
                        {v.estado === 'feito'
                          ? 'tratado'
                          : v.estado === 'nao_aplica'
                            ? 'não se aplica'
                            : v.prazo
                              ? `por fazer, até ${formatDateShort(v.prazo)}`
                              : 'por fazer'}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="actions">
        <button type="button" onClick={remove}>
          Retirar do meu dispositivo
        </button>
      </div>

      <LegalNotice />
    </>
  );
}
