// Datas de calendário sem hora nem fuso horário, sempre no formato AAAA-MM-DD.
// Internamente convertidas em número de dias desde 1970-01-01 (UTC), para evitar
// erros de mudança de hora.

export type IsoDate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isValidDate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parseDate(value: IsoDate): { year: number; month: number; day: number } {
  if (!isValidDate(value)) throw new RangeError(`Data inválida: "${value}" (formato AAAA-MM-DD)`);
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function formatDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function toDayNumber(value: IsoDate): number {
  const { year, month, day } = parseDate(value);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function fromDayNumber(n: number): IsoDate {
  const d = new Date(n * MS_PER_DAY);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(value) + days);
}

/** Número de dias de `from` até `to` (negativo se `to` for anterior). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** 0 = domingo, 6 = sábado. */
export function dayOfWeek(value: IsoDate): number {
  // 1970-01-01 foi uma quinta-feira (4).
  return (((toDayNumber(value) + 4) % 7) + 7) % 7;
}

/**
 * Soma meses mantendo o dia. Se o mês de chegada não tiver esse dia, fica no último dia
 * do mês (Código Civil, art. 279.º, alínea c)).
 */
export function addMonths(value: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseDate(value);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return formatDate(y, m, Math.min(day, daysInMonth(y, m)));
}

export function addYears(value: IsoDate, years: number): IsoDate {
  return addMonths(value, years * 12);
}

/** Data de hoje no fuso horário de Portugal continental. */
export function todayInLisbon(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(now);
}
