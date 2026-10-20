import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  dayOfWeek,
  daysBetween,
  isValidDate,
  parseDate,
  todayInLisbon,
} from './date';

describe('isValidDate', () => {
  it.each([
    ['2024-02-29', true],
    ['2023-02-29', false],
    ['2100-02-29', false],
    ['2000-02-29', true],
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['2026-1-01', false],
    ['20/10/2026', false],
  ])('%s → %s', (value, expected) => {
    expect(isValidDate(value)).toBe(expected);
  });

  it('parseDate recusa datas inválidas', () => {
    expect(() => parseDate('2026-02-30')).toThrow(RangeError);
  });
});

describe('aritmética de datas', () => {
  it('soma dias atravessando o fim do ano', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2027-01-02', -3)).toBe('2026-12-30');
  });

  it('não é afetada pela mudança da hora (último domingo de março e de outubro)', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('conta dias entre datas', () => {
    expect(daysBetween('2026-10-20', '2026-11-20')).toBe(31);
    expect(daysBetween('2026-11-20', '2026-10-20')).toBe(-31);
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
  });

  it('dia da semana (0 = domingo)', () => {
    expect(dayOfWeek('2026-10-20')).toBe(2); // terça-feira
    expect(dayOfWeek('1970-01-01')).toBe(4); // quinta-feira
    expect(dayOfWeek('1969-12-28')).toBe(0); // domingo, antes de 1970
  });
});

describe('addMonths e addYears (CC, art. 279.º, c))', () => {
  it.each([
    ['2026-01-15', 1, '2026-02-15'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-08-31', 6, '2027-02-28'],
    ['2026-11-30', 3, '2027-02-28'],
    ['2026-10-20', 12, '2027-10-20'],
    ['2026-03-31', -1, '2026-02-28'],
  ])('%s + %i meses → %s', (start, months, expected) => {
    expect(addMonths(start, months)).toBe(expected);
  });

  it('29 de fevereiro + 3 anos termina a 28 de fevereiro', () => {
    expect(addYears('2024-02-29', 3)).toBe('2027-02-28');
  });

  it('29 de fevereiro + 4 anos volta a 29 de fevereiro', () => {
    expect(addYears('2024-02-29', 4)).toBe('2028-02-29');
  });
});

describe('todayInLisbon', () => {
  it('usa a hora de Lisboa e não a UTC', () => {
    // 31 de março, 23:30 UTC = 1 de abril, 00:30 em Lisboa (hora de verão).
    expect(todayInLisbon(new Date('2026-03-31T23:30:00Z'))).toBe('2026-04-01');
    // 31 de dezembro, 23:30 UTC = 23:30 em Lisboa (hora de inverno).
    expect(todayInLisbon(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31');
  });
});
