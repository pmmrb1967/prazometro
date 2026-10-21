import { formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { LegalNotice } from '../../components/LegalNotice';
import { db } from '../../db';
import { Link, usePageHeading } from '../../router';
import { nextDeadline, progress, stepViews } from './process';
import { DevelopmentBanner } from './DevelopmentBanner';
import { POS_OBITO_RULES } from './rules';

export function ProcessList() {
  const heading = usePageHeading<HTMLHeadingElement>('Depois de um falecimento');
  const processos = useLiveQuery(() => db.processos_obito.orderBy('criado_em').reverse().toArray());
  const today = todayInLisbon();

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Depois de um falecimento
      </h1>
      <DevelopmentBanner />
      <p className="lead">
        Lamentamos a sua perda. Nesta altura há muita coisa para tratar. A app mostra os passos por
        ordem, com os prazos, os custos e as cartas de que vai precisar. Pode ir fazendo ao seu
        ritmo: o que tem prazo aparece primeiro.
      </p>

      <div className="actions">
        <Link to="/pos-obito/novo" className="button primary">
          Começar
        </Link>
      </div>

      {processos === undefined ? null : processos.length === 0 ? (
        <p className="empty">
          Só precisa de indicar a data do óbito. Tudo o que escrever fica guardado neste
          dispositivo.
        </p>
      ) : (
        <ul className="cards">
          {processos.map((p) => {
            const views = stepViews(p, POS_OBITO_RULES, today);
            const next = nextDeadline(views);
            const { feitos, total } = progress(views);
            return (
              <li key={p.id}>
                <Link to={`/pos-obito/${p.id}`} className="card-link">
                  <span className="card-title">{p.nome || 'Falecimento'}</span>
                  <span className="muted">
                    Óbito a {formatDateShort(p.data_obito)} · {feitos} de {total} passos tratados
                  </span>
                </Link>
                {next && (
                  <p>
                    Próximo prazo: <strong>{next.step.titulo}</strong>, até{' '}
                    {formatDateShort(next.prazo!)}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <LegalNotice />
    </>
  );
}
