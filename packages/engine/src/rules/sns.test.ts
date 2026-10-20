import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Facts } from '../conditions';
import { evaluateRule } from './evaluate';
import { RuleSchema } from './schema';

// Casos concretos com as regras reais do módulo SNS (Portaria n.º 153/2017, na redação da
// Portaria n.º 137/2026/1). As datas esperadas foram contadas à mão no calendário.
const dir = fileURLToPath(new URL('../../../../rules/sns/', import.meta.url));
const RULES = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => RuleSchema.parse(JSON.parse(readFileSync(dir + f, 'utf8'))));

const TODAY = '2026-10-20';

/** A única regra que se aplica aos factos, e a data em que termina o tempo máximo. */
function tmrg(facts: Facts) {
  const applying = RULES.map((r) => ({ r, res: evaluateRule(r, facts, TODAY) })).filter(
    (x) => x.res.aplica,
  );
  expect(applying.length).toBeLessThanOrEqual(1);
  return applying[0] && { id: applying[0].r.id, prazo: applying[0].res.prazo };
}

describe('SNS: cuidados de saúde primários (dias úteis)', () => {
  it('15 dias úteis saltam o Natal e o Ano Novo', () => {
    // De 22/12 a 13/01: 25/12 e 01/01 são feriados (sextas-feiras), mais 3 fins de semana.
    expect(tmrg({ tipo: 'csp_consulta', data_pedido: '2026-12-21' })).toEqual({
      id: 'sns.csp-consulta-utente',
      prazo: '2027-01-13',
    });
  });

  it('30 dias úteis saltam a Sexta-feira Santa e o 1.º de Maio', () => {
    // Sexta-feira Santa 2026: 3 de abril. 25 de Abril calha a um sábado.
    expect(tmrg({ tipo: 'csp_consulta_servicos', data_pedido: '2026-04-01' })?.prazo).toBe(
      '2026-05-15',
    );
  });

  it('72 horas: 3 dias seguidos, mesmo ao fim de semana', () => {
    expect(tmrg({ tipo: 'renovacao_medicacao', data_pedido: '2026-10-30' })?.prazo).toBe(
      '2026-11-02',
    );
    expect(tmrg({ tipo: 'documentos_csp', data_pedido: '2026-10-30' })?.prazo).toBe('2026-11-02');
  });
});

describe('SNS: primeira consulta no hospital', () => {
  const consulta = (area: string, prioridade: string, data_pedido: string) =>
    tmrg({ tipo: 'consulta_hospitalar', area, prioridade, data_pedido });

  it('muito prioritária: 30 dias; prioritária: 60; normal: 120', () => {
    expect(consulta('geral', 'muito_prioritaria', '2026-05-10')?.prazo).toBe('2026-06-09');
    expect(consulta('geral', 'prioritaria', '2026-05-10')?.prazo).toBe('2026-07-09');
    expect(consulta('geral', 'normal', '2026-01-15')?.prazo).toBe('2026-05-15');
  });

  it('doença oncológica: 7 dias (muito prioritária)', () => {
    expect(consulta('oncologica', 'muito_prioritaria', '2026-10-20')).toEqual({
      id: 'sns.consulta-oncologia-muito-prioritaria',
      prazo: '2026-10-27',
    });
  });

  it('Cardiologia prioritária: 30 dias, a passar o ano', () => {
    expect(consulta('cardiaca', 'prioritaria', '2026-12-15')?.prazo).toBe('2027-01-14');
  });

  it('sem tempo fixado na portaria: oncologia ou Cardiologia com prioridade normal', () => {
    expect(consulta('oncologica', 'normal', '2026-10-20')).toBeUndefined();
    expect(consulta('cardiaca', 'normal', '2026-10-20')).toBeUndefined();
  });
});

describe('SNS: exames e tratamentos', () => {
  it('ressonância: 90 dias, a terminar no fim de fevereiro', () => {
    expect(tmrg({ tipo: 'exame', exame: 'ressonancia', data_indicacao: '2026-11-30' })?.prazo).toBe(
      '2027-02-28',
    );
  });

  it('radioterapia: 15 dias; cateterismo: 30 dias', () => {
    expect(
      tmrg({ tipo: 'exame', exame: 'radioterapia', data_indicacao: '2026-10-20' })?.prazo,
    ).toBe('2026-11-04');
    expect(tmrg({ tipo: 'exame', exame: 'cateterismo', data_indicacao: '2026-10-20' })?.prazo).toBe(
      '2026-11-19',
    );
  });

  it('outros exames não têm tempo próprio', () => {
    expect(tmrg({ tipo: 'exame', exame: 'outro', data_indicacao: '2026-10-20' })).toBeUndefined();
  });
});

describe('SNS: cirurgias', () => {
  const cirurgia = (area: string, prioridade: string, data_indicacao: string) =>
    tmrg({ tipo: 'cirurgia', area, prioridade, data_indicacao })?.prazo;

  it('normal: 180 dias; prioritária: 30', () => {
    expect(cirurgia('geral', 'normal', '2026-03-01')).toBe('2026-08-28');
    expect(cirurgia('geral', 'prioritaria', '2026-03-01')).toBe('2026-03-31');
  });

  it('oncológica normal: 60 dias; cardíaca normal: 90 dias (sem passar para dia útil)', () => {
    expect(cirurgia('oncologica', 'normal', '2026-02-01')).toBe('2026-04-02');
    // 30 de agosto de 2026 é um domingo: a portaria não manda passar para o dia útil seguinte.
    expect(cirurgia('cardiaca', 'normal', '2026-06-01')).toBe('2026-08-30');
  });

  it('não há prioridade "muito prioritária" nas cirurgias', () => {
    expect(cirurgia('geral', 'muito_prioritaria', '2026-03-01')).toBeUndefined();
  });
});

it('sem data, nenhuma regra se aplica', () => {
  expect(
    tmrg({ tipo: 'consulta_hospitalar', area: 'geral', prioridade: 'normal' }),
  ).toBeUndefined();
});
