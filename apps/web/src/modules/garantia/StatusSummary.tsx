import { formatDateShort } from '@prazometro/engine';
import type { WarrantyStatus } from './warranty';

const LABELS = {
  ativa: 'Dentro da garantia',
  a_terminar: 'Garantia a terminar',
  terminada: 'Garantia terminada',
  nao_coberta: 'Sem garantia legal',
} as const;

function remaining(days: number): string {
  if (days === 0) return 'Hoje é o último dia.';
  if (days === 1) return 'Falta 1 dia.';
  if (days > 1) return `Faltam ${days} dias.`;
  const ago = -days;
  return ago === 1 ? 'Terminou ontem.' : `Terminou há ${ago} dias.`;
}

/** Estado da garantia em texto e numa barra de tempo; a cor nunca é a única pista. */
export function StatusSummary({ status }: { status: WarrantyStatus }) {
  return (
    <div className={`status status-${status.estado}`}>
      <p className="status-label">{LABELS[status.estado]}</p>
      {status.fim !== undefined && status.diasRestantes !== undefined && (
        <>
          <p className="status-date">
            Até <strong>{formatDateShort(status.fim)}</strong>. {remaining(status.diasRestantes)}
          </p>
          <div
            className="bar"
            role="progressbar"
            aria-label="Tempo de garantia já passado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((status.progresso ?? 0) * 100)}
          >
            <span style={{ width: `${(status.progresso ?? 0) * 100}%` }} />
          </div>
        </>
      )}
      {status.motivos.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}
