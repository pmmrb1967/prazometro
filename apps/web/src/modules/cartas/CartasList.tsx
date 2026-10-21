import { ISSUER_LABELS, LETTER_TYPE_LABELS } from '@prazometro/ai';
import { formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { LegalNotice } from '../../components/LegalNotice';
import { db } from '../../db';
import { Link, usePageHeading } from '../../router';
import { PROVIDER_LABELS } from './aiConfig';
import { DeadlineSummary } from './DeadlineSummary';
import { letterDeadline } from './rules';

export function CartasList() {
  const heading = usePageHeading<HTMLHeadingElement>('Perceber uma carta');
  const cartas = useLiveQuery(() => db.cartas.orderBy('criado_em').reverse().toArray());
  const settings = useLiveQuery(() => db.ia.get('ia'));
  const today = todayInLisbon();

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Perceber uma carta
      </h1>
      <p className="lead">
        Fotografe uma carta das Finanças, da Segurança Social, de um tribunal, do banco ou de outra
        entidade. A app lê o texto no seu telemóvel e explica, em palavras simples, quem a enviou, o
        que pede e até quando.
      </p>

      <div className="actions">
        <Link to="/cartas/nova" className="button primary">
          Ler uma carta nova
        </Link>
        <Link to="/cartas/ia" className="button">
          Definições da IA
        </Link>
      </div>
      <p className="hint">
        Leitura atual: {PROVIDER_LABELS[settings?.fornecedor ?? 'none']}.{' '}
        {(settings?.fornecedor ?? 'none') === 'none'
          ? 'A carta nunca sai do seu telemóvel.'
          : 'Antes de enviar, a app retira os dados pessoais e mostra-lhe o que vai ser enviado.'}
      </p>

      {cartas === undefined ? null : cartas.length === 0 ? (
        <p className="empty">Ainda não leu nenhuma carta.</p>
      ) : (
        <ul className="cards">
          {cartas.map((c) => (
            <li key={c.id}>
              <Link to={`/cartas/${c.id}`} className="card-link">
                <span className="card-title">{c.assunto || LETTER_TYPE_LABELS[c.tipo]}</span>
                <span className="muted">
                  {c.emissor_nome || ISSUER_LABELS[c.emissor]}
                  {c.data_carta ? ` · carta de ${formatDateShort(c.data_carta)}` : ''}
                </span>
              </Link>
              <DeadlineSummary letter={c} deadline={letterDeadline(c, today)} today={today} />
            </li>
          ))}
        </ul>
      )}

      <LegalNotice />
    </>
  );
}
