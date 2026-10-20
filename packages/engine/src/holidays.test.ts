import { describe, expect, it } from 'vitest';
import { easterSunday, isHoliday, nationalHolidays } from './holidays';

describe('easterSunday', () => {
  it.each([
    [2008, '2008-03-23'],
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('%i → %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe('nationalHolidays', () => {
  it('2026 tem os 13 feriados obrigatórios, com os móveis certos', () => {
    expect(nationalHolidays(2026).map((h) => h.date)).toEqual([
      '2026-01-01',
      '2026-04-03', // Sexta-feira Santa
      '2026-04-05', // Páscoa
      '2026-04-25',
      '2026-05-01',
      '2026-06-04', // Corpo de Deus
      '2026-06-10',
      '2026-08-15',
      '2026-10-05',
      '2026-11-01',
      '2026-12-01',
      '2026-12-08',
      '2026-12-25',
    ]);
  });

  it('Corpo de Deus calha a uma quinta-feira, 60 dias depois da Páscoa', () => {
    expect(nationalHolidays(2025).find((h) => h.name === 'Corpo de Deus')?.date).toBe('2025-06-19');
    expect(nationalHolidays(2024).find((h) => h.name === 'Corpo de Deus')?.date).toBe('2024-05-30');
  });

  it('de 2013 a 2015 não houve Corpo de Deus, 5 de Outubro, 1 de Novembro e 1 de Dezembro', () => {
    const names = nationalHolidays(2014).map((h) => h.name);
    expect(names).toHaveLength(9);
    expect(names).not.toContain('Corpo de Deus');
    expect(isHoliday('2014-10-05')).toBe(false);
    expect(isHoliday('2016-10-05')).toBe(true);
  });

  it('não inclui o Carnaval (facultativo)', () => {
    expect(isHoliday('2026-02-17')).toBe(false);
  });
});
