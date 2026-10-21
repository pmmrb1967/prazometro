import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  computeDeadline,
  isBusinessDay,
  nextBusinessDay,
  type DeadlineSpec,
} from './deadlines';

const spec = (s: Partial<DeadlineSpec>): DeadlineSpec => ({
  quantidade: 10,
  unidade: 'dias',
  contagem: 'corridos',
  transita_dia_util: false,
  ...s,
});

describe('dias úteis', () => {
  it.each([
    ['2026-10-20', true], // terça-feira
    ['2026-10-24', false], // sábado
    ['2026-10-25', false], // domingo
    ['2026-12-08', false], // feriado numa terça-feira
    ['2026-06-04', false], // Corpo de Deus
    ['2026-02-17', true], // Carnaval não é feriado obrigatório
  ])('%s → %s', (date, expected) => {
    expect(isBusinessDay(date)).toBe(expected);
  });

  it('nextBusinessDay salta fim de semana e feriado seguidos', () => {
    // Sexta-feira Santa 2026 (3 abr), sábado, domingo de Páscoa → segunda-feira 6 abr.
    expect(nextBusinessDay('2026-04-03')).toBe('2026-04-06');
    expect(nextBusinessDay('2026-10-20')).toBe('2026-10-20');
  });

  it('addBusinessDays não conta o dia de partida', () => {
    expect(addBusinessDays('2026-10-20', 0)).toBe('2026-10-20');
    expect(addBusinessDays('2026-10-20', 1)).toBe('2026-10-21');
    expect(addBusinessDays('2026-10-23', 1)).toBe('2026-10-26'); // sexta → segunda
  });

  it('addBusinessDays atravessa o Natal e o Ano Novo', () => {
    // 2026-12-24 (qui) + 5 úteis: 28, 29, 30, 31 dez, 2 jan é sábado, 1 jan feriado → 4 jan.
    expect(addBusinessDays('2026-12-24', 5)).toBe('2027-01-04');
  });

  it('recusa quantidades negativas ou fracionárias', () => {
    expect(() => addBusinessDays('2026-10-20', -1)).toThrow(RangeError);
    expect(() => addBusinessDays('2026-10-20', 1.5)).toThrow(RangeError);
  });
});

describe('computeDeadline', () => {
  it('dias corridos sem contar o dia do evento', () => {
    expect(computeDeadline('2026-10-20', spec({ quantidade: 10 }))).toBe('2026-10-30');
  });

  it('dias corridos que terminam num domingo transitam para segunda-feira', () => {
    // 2026-10-15 + 10 = domingo 25 out.
    expect(computeDeadline('2026-10-15', spec({ transita_dia_util: true }))).toBe('2026-10-26');
    expect(computeDeadline('2026-10-15', spec({ transita_dia_util: false }))).toBe('2026-10-25');
  });

  it('prazo civil que termina num sábado NÃO transita (CC, art. 279.º, e))', () => {
    // 2026-10-14 + 10 = sábado 24 out.
    expect(computeDeadline('2026-10-14', spec({ transita_dia_util: true }))).toBe('2026-10-24');
  });

  it('prazo perante serviço fechado ao sábado transita para segunda-feira', () => {
    expect(
      computeDeadline(
        '2026-10-14',
        spec({ transita_dia_util: true, transicao: 'sabado_domingo_feriado' }),
      ),
    ).toBe('2026-10-26');
  });

  it('prazo que termina num feriado a meio da semana transita para o dia seguinte', () => {
    // 2026-11-28 + 10 = terça 8 dez (Imaculada Conceição) → quarta 9 dez.
    expect(computeDeadline('2026-11-28', spec({ transita_dia_util: true }))).toBe('2026-12-09');
  });

  it('prazo que termina na Sexta-feira Santa salta todo o fim de semana da Páscoa', () => {
    // 2026-03-24 + 10 = sexta 3 abr → segunda 6 abr.
    expect(computeDeadline('2026-03-24', spec({ transita_dia_util: true }))).toBe('2026-04-06');
  });

  it('dias úteis saltam fins de semana e feriados', () => {
    // 2026-10-20 (ter) + 10 úteis: 21, 22, 23, 26, 27, 28, 29, 30 out, 2, 3 nov.
    expect(computeDeadline('2026-10-20', spec({ contagem: 'uteis' }))).toBe('2026-11-03');
  });

  it('dias úteis com Corpo de Deus e 10 de junho na mesma semana (2026)', () => {
    // 2026-06-01 (seg) + 5 úteis: 2, 3, [4 feriado], 5, 8, 9 → 9 jun.
    expect(computeDeadline('2026-06-01', spec({ quantidade: 5, contagem: 'uteis' }))).toBe(
      '2026-06-09',
    );
  });

  it('meses terminam no último dia do mês quando não há dia correspondente', () => {
    expect(computeDeadline('2026-01-31', spec({ quantidade: 1, unidade: 'meses' }))).toBe(
      '2026-02-28',
    );
  });

  it('meses que terminam num domingo transitam', () => {
    // 2026-08-31 + 6 meses = 2027-02-28, domingo → segunda 1 mar.
    expect(
      computeDeadline(
        '2026-08-31',
        spec({ quantidade: 6, unidade: 'meses', transita_dia_util: true }),
      ),
    ).toBe('2027-03-01');
  });

  it('garantia de 3 anos sobre uma compra a 29 de fevereiro', () => {
    expect(computeDeadline('2024-02-29', spec({ quantidade: 3, unidade: 'anos' }))).toBe(
      '2027-02-28',
    );
  });

  it('anos que terminam no dia de Natal transitam', () => {
    // 2023-12-25 + 3 anos = sexta 25 dez 2026 (feriado) → segunda 28 dez.
    expect(
      computeDeadline(
        '2023-12-25',
        spec({ quantidade: 3, unidade: 'anos', transita_dia_util: true }),
      ),
    ).toBe('2026-12-28');
  });

  it('prazo de 30 dias corridos atravessa o fim do ano', () => {
    expect(computeDeadline('2026-12-15', spec({ quantidade: 30 }))).toBe('2027-01-14');
  });

  it('recusa dias úteis com meses ou anos', () => {
    expect(() =>
      computeDeadline('2026-10-20', spec({ unidade: 'meses', contagem: 'uteis' })),
    ).toThrow(RangeError);
  });
});

describe('computeDeadline com fim_do_mes ("até ao final do 3.º mês seguinte")', () => {
  const tresMeses = spec({ quantidade: 3, unidade: 'meses', fim_do_mes: true });

  it('termina no último dia do terceiro mês seguinte', () => {
    expect(computeDeadline('2026-01-15', tresMeses)).toBe('2026-04-30');
  });

  it('a partir de fevereiro chega ao fim de maio, e não a 28 de maio', () => {
    expect(computeDeadline('2026-02-28', tresMeses)).toBe('2026-05-31');
  });

  it('se o último dia for domingo, transita para segunda-feira', () => {
    // 31/05/2026 é domingo.
    expect(computeDeadline('2026-02-28', { ...tresMeses, transita_dia_util: true })).toBe(
      '2026-06-01',
    );
    // 28/02/2027 é domingo; fevereiro de 2027 tem 28 dias.
    expect(computeDeadline('2026-11-30', { ...tresMeses, transita_dia_util: true })).toBe(
      '2027-03-01',
    );
  });

  it('respeita os anos bissextos', () => {
    expect(computeDeadline('2027-11-15', tresMeses)).toBe('2028-02-29');
  });

  it('não se aplica a dias', () => {
    expect(() => computeDeadline('2026-10-20', spec({ fim_do_mes: true }))).toThrow(RangeError);
  });
});
