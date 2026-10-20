import { addDays, addMonths, addYears, dayOfWeek, type IsoDate } from './date';
import { isHoliday } from './holidays';

// Contagem de prazos segundo o Código Civil, art. 279.º:
// - não se conta o dia do evento que faz correr o prazo (alínea b));
// - prazos em meses ou anos terminam no dia correspondente ou, se não existir, no último dia
//   do mês (alínea c));
// - o prazo que termine em domingo ou feriado passa para o primeiro dia útil (alínea e)).
//   Um sábado NÃO transita segundo o Código Civil. Quando a regra diz respeito a um serviço ou
//   tribunal fechado ao sábado (por exemplo, CPA art. 87.º ou CPC art. 138.º), a regra tem de o
//   indicar com `transicao: "sabado_domingo_feriado"`.
// Na contagem em dias úteis não contam sábados, domingos nem feriados nacionais.
// Na dúvida, o motor dá sempre a data mais cedo: é a que protege quem usa a app.

export type DeadlineUnit = 'dias' | 'meses' | 'anos';
export type DeadlineCounting = 'corridos' | 'uteis';
export type DeadlineTransition = 'domingo_feriado' | 'sabado_domingo_feriado';

export type DeadlineSpec = {
  quantidade: number;
  unidade: DeadlineUnit;
  contagem: DeadlineCounting;
  transita_dia_util: boolean;
  /** Que dias fazem o fim do prazo passar para o dia útil seguinte. Por defeito, domingo e feriado. */
  transicao?: DeadlineTransition;
};

export function isBusinessDay(date: IsoDate): boolean {
  const dow = dayOfWeek(date);
  return dow !== 0 && dow !== 6 && !isHoliday(date);
}

/** A própria data, se for dia útil; senão, o primeiro dia útil seguinte. */
export function nextBusinessDay(date: IsoDate): IsoDate {
  let d = date;
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

/** Soma `count` dias úteis, sem contar o dia de partida. */
export function addBusinessDays(date: IsoDate, count: number): IsoDate {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Número de dias úteis inválido: ${count}`);
  }
  let d = date;
  let remaining = count;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

function mustTransit(date: IsoDate, transition: DeadlineTransition): boolean {
  const dow = dayOfWeek(date);
  if (dow === 0 || isHoliday(date)) return true;
  return dow === 6 && transition === 'sabado_domingo_feriado';
}

/** Último dia do prazo que começa a correr em `start` (o dia do evento). */
export function computeDeadline(start: IsoDate, spec: DeadlineSpec): IsoDate {
  const { quantidade, unidade, contagem, transita_dia_util } = spec;
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    throw new RangeError(`Quantidade de prazo inválida: ${quantidade}`);
  }

  let end: IsoDate;
  if (contagem === 'uteis') {
    if (unidade !== 'dias') throw new RangeError('A contagem em dias úteis só se aplica a dias');
    end = addBusinessDays(start, quantidade);
  } else if (unidade === 'dias') {
    end = addDays(start, quantidade);
  } else if (unidade === 'meses') {
    end = addMonths(start, quantidade);
  } else {
    end = addYears(start, quantidade);
  }

  if (transita_dia_util && mustTransit(end, spec.transicao ?? 'domingo_feriado')) {
    end = nextBusinessDay(end);
  }
  return end;
}
