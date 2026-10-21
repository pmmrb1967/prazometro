import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Facts } from '../conditions';
import { evaluateRule } from './evaluate';
import { RuleSchema } from './schema';

// Casos concretos com as regras reais do módulo Pós-óbito. As datas esperadas foram contadas à
// mão no calendário.
const dir = fileURLToPath(new URL('../../../../rules/pos-obito/', import.meta.url));
const RULES = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => RuleSchema.parse(JSON.parse(readFileSync(dir + f, 'utf8'))));

const TODAY = '2026-10-21';

function deadlines(facts: Facts): Record<string, string | undefined> {
  return Object.fromEntries(
    RULES.map((r) => [r.id.replace('pos-obito.', ''), evaluateRule(r, facts, TODAY).prazo]),
  );
}

describe('Pós-óbito: óbito a 15/01/2026, registado a 16/01/2026', () => {
  const d = deadlines({ data_obito: '2026-01-15', data_registo_obito: '2026-01-16' });

  it('declaração do óbito em 48 horas', () => expect(d['declaracao-obito']).toBe('2026-01-17'));
  it('reembolso do funeral: 90 dias desde o registo', () =>
    expect(d['reembolso-funeral']).toBe('2026-04-16'));
  it('participação às Finanças: até ao fim de abril', () =>
    expect(d['participacao-imposto-selo']).toBe('2026-04-30'));
  it('pensão de sobrevivência: 6 meses', () =>
    expect(d['pensao-sobrevivencia']).toBe('2026-07-15'));
  it('subsídio por morte: 180 dias desde o registo', () =>
    expect(d['subsidio-morte']).toBe('2026-07-15'));
  it('aceitação da herança: 10 anos', () => expect(d['aceitacao-heranca']).toBe('2036-01-15'));
});

describe('Pós-óbito: participação às Finanças no fim do mês', () => {
  it('fim de maio a um domingo passa para segunda-feira', () => {
    expect(deadlines({ data_obito: '2026-02-28' })['participacao-imposto-selo']).toBe('2026-06-01');
  });

  it('um sábado não transita (regime civil)', () => {
    // 31/10/2026 é sábado.
    expect(deadlines({ data_obito: '2026-07-10' })['participacao-imposto-selo']).toBe('2026-10-31');
  });
});

it('sem data do registo, os prazos da Segurança Social não se aplicam', () => {
  const d = deadlines({ data_obito: '2026-01-15' });
  expect(d['subsidio-morte']).toBeUndefined();
  expect(d['reembolso-funeral']).toBeUndefined();
});
