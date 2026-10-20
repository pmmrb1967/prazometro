import { parseDate, type IsoDate } from '../date';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "2026-10-20" → "20 de outubro de 2026" (meses em minúscula, como manda o Acordo Ortográfico). */
export function formatDateLong(date: IsoDate): string {
  const { year, month, day } = parseDate(date);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

/** "2026-10-20" → "20/10/2026". */
export function formatDateShort(date: IsoDate): string {
  const { year, month, day } = parseDate(date);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}
