import { addDays, formatDate, type IsoDate } from './date';

// Feriados nacionais obrigatórios (Código do Trabalho, art. 234.º).
// O Carnaval é facultativo e os feriados municipais variam por concelho: nenhum conta aqui.
// Corpo de Deus, 5 de Outubro, 1 de Novembro e 1 de Dezembro estiveram suspensos de 2013 a
// 2015 (Lei n.º 23/2012) e foram repostos pela Lei n.º 8/2016.
export const HOLIDAYS_SOURCE = {
  titulo: 'Código do Trabalho (Lei n.º 7/2009), na redação da Lei n.º 8/2016',
  url: 'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475',
  artigo: '234.º',
  verificado_em: '2026-10-20',
} as const;

export type Holiday = { date: IsoDate; name: string };

/** Domingo de Páscoa no calendário gregoriano (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatDate(year, month, day);
}

function suspended(year: number): boolean {
  return year >= 2013 && year <= 2015;
}

export function nationalHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed = (month: number, day: number, name: string): Holiday => ({
    date: formatDate(year, month, day),
    name,
  });

  const list: Holiday[] = [
    fixed(1, 1, 'Ano Novo'),
    { date: addDays(easter, -2), name: 'Sexta-feira Santa' },
    { date: easter, name: 'Domingo de Páscoa' },
    fixed(4, 25, 'Dia da Liberdade'),
    fixed(5, 1, 'Dia do Trabalhador'),
    fixed(6, 10, 'Dia de Portugal'),
    fixed(8, 15, 'Assunção de Nossa Senhora'),
    fixed(12, 8, 'Imaculada Conceição'),
    fixed(12, 25, 'Natal'),
  ];
  if (!suspended(year)) {
    list.push(
      { date: addDays(easter, 60), name: 'Corpo de Deus' },
      fixed(10, 5, 'Implantação da República'),
      fixed(11, 1, 'Todos os Santos'),
      fixed(12, 1, 'Restauração da Independência'),
    );
  }
  return list.sort((x, y) => x.date.localeCompare(y.date));
}

const cache = new Map<number, Set<IsoDate>>();

export function isHoliday(date: IsoDate): boolean {
  const year = Number(date.slice(0, 4));
  let set = cache.get(year);
  if (!set) {
    set = new Set(nationalHolidays(year).map((h) => h.date));
    cache.set(year, set);
  }
  return set.has(date);
}
