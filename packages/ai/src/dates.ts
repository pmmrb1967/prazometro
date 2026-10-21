// Datas escritas numa carta: "21/10/2026", "21-10-2026", "21.10.2026", "2026-10-21" e
// "21 de outubro de 2026". Servem para o fornecedor sem IA, para proteger as datas na
// anonimização e para descartar datas que a IA indique e não estejam na carta.

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

export const DATE_PATTERN = new RegExp(
  [
    String.raw`\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b`,
    String.raw`\b(\d{4})-(\d{2})-(\d{2})\b`,
    String.raw`\b(\d{1,2})\.?º?\s+de\s+(${MONTHS.join('|')}|marco)\s+(?:de\s+)?(\d{4})\b`,
  ].join('|'),
  'gi',
);

export type FoundDate = { data: string; inicio: number; fim: number };

function valid(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > last) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function findDates(text: string): FoundDate[] {
  const out: FoundDate[] = [];
  for (const m of text.matchAll(DATE_PATTERN)) {
    let iso: string | null = null;
    if (m[1]) iso = valid(+m[3]!, +m[2]!, +m[1]);
    else if (m[4]) iso = valid(+m[4], +m[5]!, +m[6]!);
    else if (m[7]) {
      const name = m[8]!.toLowerCase().replace('marco', 'março');
      iso = valid(+m[9]!, MONTHS.indexOf(name) + 1, +m[7]);
    }
    if (iso) out.push({ data: iso, inicio: m.index, fim: m.index + m[0].length });
  }
  return out;
}

/** Datas distintas, pela ordem em que aparecem. */
export function uniqueDates(text: string): string[] {
  return [...new Set(findDates(text).map((d) => d.data))];
}
