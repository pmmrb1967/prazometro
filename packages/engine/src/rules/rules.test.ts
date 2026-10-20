import { describe, expect, it } from 'vitest';
import { evaluateConditions } from '../conditions';
import { evaluateRule } from './evaluate';
import { exampleRule } from './fixtures';
import { RuleSchema } from './schema';
import { verificationStatus } from './verification';

describe('evaluateConditions', () => {
  it('igualdade simples em todos os campos', () => {
    const c = { estado: 'novo', vendedor: 'profissional' };
    expect(evaluateConditions(c, { estado: 'novo', vendedor: 'profissional' }).ok).toBe(true);
    expect(evaluateConditions(c, { estado: 'usado', vendedor: 'profissional' })).toEqual({
      ok: false,
      falhas: ['estado'],
    });
  });

  it('campo em falta não cumpre a condição', () => {
    expect(evaluateConditions({ estado: 'novo' }, {}).ok).toBe(false);
  });

  it('operadores em, nao_em, diferente e existe', () => {
    const facts = { prioridade: 'normal', tipo: 'consulta' };
    expect(evaluateConditions({ prioridade: { em: ['normal', 'prioritario'] } }, facts).ok).toBe(
      true,
    );
    expect(evaluateConditions({ prioridade: { nao_em: ['normal'] } }, facts).ok).toBe(false);
    expect(evaluateConditions({ tipo: { diferente: 'cirurgia' } }, facts).ok).toBe(true);
    expect(evaluateConditions({ nota: { existe: false } }, facts).ok).toBe(true);
    expect(evaluateConditions({ tipo: { existe: true } }, facts).ok).toBe(true);
  });

  it('min e max com números e com datas', () => {
    expect(evaluateConditions({ preco: { min: 10, max: 100 } }, { preco: 50 }).ok).toBe(true);
    expect(evaluateConditions({ preco: { min: 10 } }, { preco: 5 }).ok).toBe(false);
    expect(
      evaluateConditions({ data_compra: { min: '2022-01-01' } }, { data_compra: '2021-12-31' }).ok,
    ).toBe(false);
    expect(evaluateConditions({ preco: { min: 10 } }, { preco: '50' }).ok).toBe(false);
  });

  it('"qualquer" basta uma das opções', () => {
    const c = { qualquer: [{ estado: 'novo' }, { estado: 'recondicionado' }] };
    expect(evaluateConditions(c, { estado: 'recondicionado' }).ok).toBe(true);
    expect(evaluateConditions(c, { estado: 'usado' })).toEqual({ ok: false, falhas: ['qualquer'] });
  });
});

describe('RuleSchema', () => {
  it('aceita a regra de exemplo', () => {
    expect(RuleSchema.safeParse(exampleRule).success).toBe(true);
  });

  it('recusa uma regra sem fontes', () => {
    const r = RuleSchema.safeParse({ ...exampleRule, fontes: [] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain('sem fonte');
  });

  it('recusa uma regra sem verificado_em ou com data inválida', () => {
    const { verificado_em: _, ...semData } = exampleRule;
    expect(RuleSchema.safeParse(semData).success).toBe(false);
    expect(RuleSchema.safeParse({ ...exampleRule, verificado_em: '2026-02-30' }).success).toBe(
      false,
    );
  });

  it('recusa fontes sem https e campos desconhecidos', () => {
    const http = {
      ...exampleRule,
      fontes: [{ titulo: 'x', url: 'http://example.org', artigo: '1' }],
    };
    expect(RuleSchema.safeParse(http).success).toBe(false);
    expect(RuleSchema.safeParse({ ...exampleRule, extra: 1 }).success).toBe(false);
  });

  it('recusa dias úteis com meses e id fora do módulo', () => {
    const uteis = { ...exampleRule, prazo: { ...exampleRule.prazo, contagem: 'uteis' } };
    expect(RuleSchema.safeParse(uteis).success).toBe(false);
    expect(RuleSchema.safeParse({ ...exampleRule, id: 'sns.exemplo' }).success).toBe(false);
  });
});

describe('verificationStatus', () => {
  const rule = { verificado_em: '2026-04-30', estado: 'publicada' as const };

  it('fica "a verificar" só depois de passarem 6 meses', () => {
    expect(verificationStatus(rule, '2026-10-30')).toBe('verificada');
    expect(verificationStatus(rule, '2026-10-31')).toBe('a_verificar');
  });

  it('6 meses a partir de 31 de agosto terminam no fim de fevereiro', () => {
    const r = { verificado_em: '2026-08-31', estado: 'publicada' as const };
    expect(verificationStatus(r, '2027-02-28')).toBe('verificada');
    expect(verificationStatus(r, '2027-03-01')).toBe('a_verificar');
  });

  it('uma regra "a_rever" mantém-se assim', () => {
    expect(verificationStatus({ ...rule, estado: 'a_rever' }, '2026-05-01')).toBe('a_rever');
  });
});

describe('evaluateRule', () => {
  it('calcula prazo, marcos e alertas por ordem de data', () => {
    const r = evaluateRule(
      exampleRule,
      { estado: 'novo', vendedor: 'profissional' },
      '2026-10-20',
      '2026-10-20',
    );
    expect(r.aplica).toBe(true);
    expect(r.prazo).toBe('2029-10-20');
    expect(r.marcos).toEqual([
      { id: 'fim-presuncao', data: '2028-10-20', texto: 'Marco de exemplo aos 2 anos.' },
    ]);
    expect(r.alertas.map((a) => [a.data, a.tipo])).toEqual([
      ['2028-09-20', 'marco'],
      ['2029-09-20', 'prazo'],
      ['2029-10-20', 'prazo'],
    ]);
    expect(r.alertas[1]?.texto).toBe(
      'Faltam 30 dias para o fim do prazo: Regra de exemplo para testes.',
    );
  });

  it('não calcula nada quando as condições não se cumprem', () => {
    const r = evaluateRule(exampleRule, { estado: 'usado' }, '2026-10-20', '2026-10-20');
    expect(r).toMatchObject({
      aplica: false,
      falhas: ['estado', 'vendedor'],
      marcos: [],
      alertas: [],
    });
    expect(r.prazo).toBeUndefined();
  });

  it('indica o estado de verificação da regra', () => {
    const r = evaluateRule(exampleRule, {}, '2026-10-20', '2027-06-01');
    expect(r.verificacao).toBe('a_verificar');
  });
});
