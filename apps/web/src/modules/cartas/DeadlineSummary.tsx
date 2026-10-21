import { daysBetween, formatDateShort } from '@prazometro/engine';
import type { ReceivedLetter } from '../../db';
import type { LetterDeadline } from './rules';

const days = (n: number) => (n === 1 ? '1 dia' : `${n} dias`);

/** Datas que a carta diz serem um limite (lidas da carta, não calculadas). */
export function writtenLimit(letter: ReceivedLetter) {
  return letter.datas.find((d) => /limite|até|prazo|pagar/i.test(d.descricao));
}

/** Estado do prazo em texto; a cor nunca é a única pista. */
export function DeadlineSummary({
  letter,
  deadline,
  today,
}: {
  letter: ReceivedLetter;
  deadline?: LetterDeadline;
  today: string;
}) {
  if (letter.tratada_em) {
    return (
      <div className="status status-ativa">
        <p className="status-label">Tratado em {formatDateShort(letter.tratada_em)}</p>
      </div>
    );
  }
  if (deadline?.result.prazo) {
    const left = daysBetween(today, deadline.result.prazo);
    const state = left < 0 ? 'ultrapassado' : left <= 5 ? 'a_terminar' : 'ativa';
    return (
      <div className={`status status-${state}`}>
        <p className="status-label">
          {left < 0
            ? 'O prazo já terminou'
            : left <= 5
              ? 'O prazo está a terminar'
              : 'Dentro do prazo'}
        </p>
        <p className="status-date">
          {left < 0 ? 'Terminou' : 'Até'} <strong>{formatDateShort(deadline.result.prazo)}</strong>.{' '}
          {left === 0 ? 'Hoje é o último dia.' : left > 0 ? `Faltam ${days(left)}.` : ''}
        </p>
      </div>
    );
  }
  const limit = writtenLimit(letter);
  if (limit) {
    return (
      <div className="status status-terminada">
        <p className="status-label">Data indicada na carta</p>
        <p className="status-date">
          {limit.descricao}: <strong>{formatDateShort(limit.data)}</strong>. Confirme na carta
          original.
        </p>
      </div>
    );
  }
  return (
    <div className="status status-terminada">
      <p className="status-label">Sem prazo calculado</p>
      <p className="status-date">Veja na carta se há uma data limite.</p>
    </div>
  );
}
