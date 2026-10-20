import { formatDateShort } from '@prazometro/engine';
import type { WaitStatus } from './waiting';

const LABELS = {
  dentro: 'Dentro do tempo máximo',
  a_terminar: 'O tempo máximo está a terminar',
  ultrapassado: 'Tempo máximo ultrapassado',
  cumprido: 'Atendido dentro do tempo máximo',
  cumprido_tarde: 'Atendido depois do tempo máximo',
  sem_prioridade: 'Falta saber a prioridade',
  sem_tmrg: 'Sem tempo máximo fixado',
} as const;

const CLASS = {
  dentro: 'ativa',
  a_terminar: 'a_terminar',
  ultrapassado: 'ultrapassado',
  cumprido: 'ativa',
  cumprido_tarde: 'terminada',
  sem_prioridade: 'terminada',
  sem_tmrg: 'terminada',
} as const;

function days(n: number) {
  return n === 1 ? '1 dia' : `${n} dias`;
}

/** Estado da espera em texto e numa barra de tempo; a cor nunca é a única pista. */
export function WaitSummary({ status: s }: { status: WaitStatus }) {
  return (
    <div className={`status status-${CLASS[s.estado]}`}>
      <p className="status-label">{LABELS[s.estado]}</p>
      {s.prazo && (s.estado === 'dentro' || s.estado === 'a_terminar') && (
        <p className="status-date">
          Até <strong>{formatDateShort(s.prazo)}</strong>.{' '}
          {s.diasRestantes === 0 ? 'Hoje é o último dia.' : `Faltam ${days(s.diasRestantes!)}.`}
        </p>
      )}
      {s.prazo && s.estado === 'ultrapassado' && (
        <p className="status-date">
          Terminou em <strong>{formatDateShort(s.prazo)}</strong>. Está à espera há mais{' '}
          {days(s.diasAtraso!)} do que o tempo máximo.
        </p>
      )}
      {s.prazo && s.estado === 'cumprido' && (
        <p className="status-date">O tempo máximo terminava em {formatDateShort(s.prazo)}.</p>
      )}
      {s.prazo && s.estado === 'cumprido_tarde' && (
        <p className="status-date">
          O tempo máximo terminava em {formatDateShort(s.prazo)}: foi atendido {days(s.diasAtraso!)}{' '}
          depois.
        </p>
      )}
      {s.prazo &&
        (s.estado === 'dentro' || s.estado === 'a_terminar' || s.estado === 'ultrapassado') && (
          <div
            className="bar"
            role="progressbar"
            aria-label="Tempo de espera já passado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((s.progresso ?? 0) * 100)}
          >
            <span style={{ width: `${(s.progresso ?? 0) * 100}%` }} />
          </div>
        )}
      {s.marcadaDepois !== undefined && (
        <p>
          <strong>A data marcada fica {days(s.marcadaDepois)} depois do tempo máximo.</strong>
        </p>
      )}
    </div>
  );
}
