import { describe, expect, it } from 'vitest';
import type { WaitRequest } from '../../db';
import { SNS_RULES } from './rules';
import { calendarEvents, tmrgText, waitStatus } from './waiting';

const base: WaitRequest = {
  id: 'w1',
  tipo: 'consulta_hospitalar',
  descricao: 'Consulta de Ortopedia',
  area: 'geral',
  prioridade: 'normal',
  data_pedido: '2026-06-01',
  criado_em: '2026-06-01',
};

describe('waitStatus', () => {
  it('dentro do prazo: faltam dias até aos 120 dias seguidos', () => {
    const s = waitStatus(base, SNS_RULES, '2026-08-01');
    expect(s.estado).toBe('dentro');
    expect(s.prazo).toBe('2026-09-29');
    expect(s.diasRestantes).toBe(59);
    expect(tmrgText(s.rule!)).toBe('120 dias seguidos');
  });

  it('a terminar na última semana; ultrapassado depois', () => {
    expect(waitStatus(base, SNS_RULES, '2026-09-22').estado).toBe('a_terminar');
    const s = waitStatus(base, SNS_RULES, '2026-10-20');
    expect(s.estado).toBe('ultrapassado');
    expect(s.diasAtraso).toBe(21);
  });

  it('data marcada depois do tempo máximo', () => {
    const s = waitStatus({ ...base, data_marcada: '2026-10-15' }, SNS_RULES, '2026-08-01');
    expect(s.estado).toBe('dentro');
    expect(s.marcadaDepois).toBe(16);
  });

  it('já atendido: a tempo ou com atraso', () => {
    expect(
      waitStatus({ ...base, realizado_em: '2026-09-29' }, SNS_RULES, '2026-10-20').estado,
    ).toBe('cumprido');
    const tarde = waitStatus({ ...base, realizado_em: '2026-10-09' }, SNS_RULES, '2026-10-20');
    expect(tarde.estado).toBe('cumprido_tarde');
    expect(tarde.diasAtraso).toBe(10);
  });

  it('prioridade desconhecida: mostra o tempo máximo de cada prioridade', () => {
    const s = waitStatus({ ...base, prioridade: 'nao_sei' }, SNS_RULES, '2026-08-01');
    expect(s.estado).toBe('sem_prioridade');
    expect(s.possibilidades.map((p) => [p.prioridade, p.prazo])).toEqual([
      ['muito_prioritaria', '2026-07-01'],
      ['prioritaria', '2026-07-31'],
      ['normal', '2026-09-29'],
    ]);
  });

  it('sem tempo máximo fixado: outro exame', () => {
    const s = waitStatus(
      {
        ...base,
        tipo: 'exame',
        exame: 'outro',
        data_indicacao: '2026-06-01',
        data_pedido: undefined,
      },
      SNS_RULES,
      '2026-08-01',
    );
    expect(s.estado).toBe('sem_tmrg');
  });

  it('renovação de receitas: 72 horas', () => {
    const s = waitStatus(
      { ...base, tipo: 'renovacao_medicacao', area: undefined, prioridade: undefined },
      SNS_RULES,
      '2026-06-02',
    );
    expect(s.prazo).toBe('2026-06-04');
    expect(tmrgText(s.rule!)).toBe('72 horas');
  });
});

describe('calendarEvents', () => {
  it('um lembrete no fim do tempo máximo, só enquanto espera', () => {
    const s = waitStatus(base, SNS_RULES, '2026-08-01');
    expect(
      calendarEvents(base, s, '2026-08-01').map((e) => [e.data, e.alarmes_dias_antes]),
    ).toEqual([['2026-09-29', [7, 0]]]);
    const feito = { ...base, realizado_em: '2026-09-01' };
    expect(calendarEvents(feito, waitStatus(feito, SNS_RULES, '2026-08-01'), '2026-08-01')).toEqual(
      [],
    );
  });
});
