import { describe, expect, it } from 'vitest';
import type { Purchase } from '../../db';
import { GARANTIA_RULES } from './rules';
import { calendarEvents, warrantyStatus } from './warranty';

const base: Purchase = {
  id: 'p1',
  produto: 'Máquina de lavar',
  loja: 'Loja Exemplo',
  data_compra: '2025-03-10',
  data_entrega: '2025-03-10',
  estado: 'novo',
  tipo_vendedor: 'profissional',
  uso: 'pessoal',
  criado_em: '2025-03-10',
};

describe('warrantyStatus', () => {
  it('bem novo: garantia ativa até 3 anos depois da entrega', () => {
    const s = warrantyStatus(base, GARANTIA_RULES, '2026-10-20');
    expect(s.estado).toBe('ativa');
    expect(s.fim).toBe('2028-03-10');
    expect(s.diasRestantes).toBe(507);
    expect(s.proximoMarco?.id).toBe('fim-presuncao');
    expect(s.progresso).toBeCloseTo(589 / 1096, 5);
  });

  it('fica "a terminar" nos últimos 60 dias e "terminada" depois do fim', () => {
    expect(warrantyStatus(base, GARANTIA_RULES, '2028-01-10').estado).toBe('a_terminar');
    expect(warrantyStatus(base, GARANTIA_RULES, '2028-03-10').estado).toBe('a_terminar');
    expect(warrantyStatus(base, GARANTIA_RULES, '2028-03-11').estado).toBe('terminada');
  });

  it('usado sem saber se houve acordo: usa os 18 meses por precaução', () => {
    const s = warrantyStatus({ ...base, estado: 'usado' }, GARANTIA_RULES, '2026-01-01');
    expect(s.principal?.rule.id).toBe('garantia.usados-prazo-reduzido');
    expect(s.fim).toBe('2026-09-10');
  });

  it('compra a um particular não está coberta, com o motivo explicado', () => {
    const s = warrantyStatus(
      { ...base, tipo_vendedor: 'particular' },
      GARANTIA_RULES,
      '2026-10-20',
    );
    expect(s.estado).toBe('nao_coberta');
    expect(s.motivos).toEqual([expect.stringContaining('particular')]);
  });

  it('bem trocado: a garantia principal passa a ser a do bem recebido em troca', () => {
    const s = warrantyStatus(
      { ...base, data_entrega_substituto: '2026-05-04' },
      GARANTIA_RULES,
      '2026-10-20',
    );
    expect(s.principal?.rule.id).toBe('garantia.substituicao');
    expect(s.fim).toBe('2029-05-04');
  });

  it('depois de comunicar o defeito, mostra o prazo de reparação e o dos direitos', () => {
    const s = warrantyStatus(
      { ...base, data_comunicacao: '2026-10-20' },
      GARANTIA_RULES,
      '2026-10-20',
    );
    expect(s.aposComunicacao.map((e) => [e.rule.id, e.result.prazo])).toEqual([
      ['garantia.prazo-reparacao', '2026-11-19'],
      ['garantia.caducidade-direitos', '2028-10-20'],
    ]);
  });
});

describe('calendarEvents', () => {
  it('só inclui datas futuras, com os alarmes das regras', () => {
    const today = '2026-10-20';
    const s = warrantyStatus(base, GARANTIA_RULES, today);
    const events = calendarEvents(base, s, today);
    expect(events.map((e) => [e.data, e.alarmes_dias_antes])).toEqual([
      ['2027-03-10', [30]],
      ['2028-03-10', [60, 30]],
    ]);
    expect(events[1]?.titulo).toBe('Garantia legal de 3 anos: Máquina de lavar');
  });
});
