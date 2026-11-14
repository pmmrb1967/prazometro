import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Facts } from '../conditions';
import { evaluateRule } from './evaluate';
import { RuleSchema } from './schema';

// Casos concretos com as regras reais do módulo Cartas. As datas esperadas foram contadas à
// mão no calendário.
const dir = fileURLToPath(new URL('../../../../rules/cartas/', import.meta.url));
const RULES = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => RuleSchema.parse(JSON.parse(readFileSync(dir + f, 'utf8'))));

const TODAY = '2026-10-21';

function deadline(facts: Facts) {
  const applying = RULES.map((r) => ({ r, res: evaluateRule(r, facts, TODAY) })).filter(
    (x) => x.res.aplica,
  );
  expect(applying.length).toBeLessThanOrEqual(1);
  return applying[0] && { id: applying[0].r.id, prazo: applying[0].res.prazo };
}

describe('Cartas: multa de trânsito (15 dias úteis)', () => {
  it('salta fins de semana e o feriado de 8 de dezembro', () => {
    // Notificado a 1/12 (feriado, terça). Conta de 2/12; 8/12 (terça) é feriado.
    expect(deadline({ tipo_carta: 'contraordenacao_transito', data_inicio: '2026-12-01' })).toEqual(
      { id: 'cartas.contraordenacao-transito', prazo: '2026-12-23' },
    );
  });
});

describe('Cartas: audição prévia nas Finanças (15 dias seguidos)', () => {
  it('conta dias seguidos', () => {
    expect(deadline({ tipo_carta: 'audicao_previa_at', data_inicio: '2026-09-14' })?.prazo).toBe(
      '2026-09-29',
    );
  });

  it('se acabar num domingo (Páscoa de 2026), passa para segunda-feira', () => {
    expect(deadline({ tipo_carta: 'audicao_previa_at', data_inicio: '2026-03-21' })?.prazo).toBe(
      '2026-04-06',
    );
  });
});

describe('Cartas: citação para contestar (30 dias, tribunais fechados ao sábado)', () => {
  it('conta 30 dias seguidos', () => {
    expect(deadline({ tipo_carta: 'citacao_tribunal', data_inicio: '2026-09-30' })?.prazo).toBe(
      '2026-10-30',
    );
  });

  it('um fim num sábado passa para o dia útil seguinte (1/11 é domingo e feriado)', () => {
    expect(deadline({ tipo_carta: 'citacao_tribunal', data_inicio: '2026-10-01' })?.prazo).toBe(
      '2026-11-02',
    );
  });
});

describe('Cartas: citação numa execução (20 dias, art. 728.º CPC)', () => {
  it('conta 20 dias seguidos, mais cedo do que a citação para contestar (30)', () => {
    // Citada a 9/4/2021 (sexta): 20 dias acabam a 29/4/2021 (quinta).
    expect(deadline({ tipo_carta: 'citacao_execucao', data_inicio: '2021-04-09' })).toEqual({
      id: 'cartas.citacao-execucao',
      prazo: '2021-04-29',
    });
  });

  it('um fim num sábado passa para segunda-feira', () => {
    // 4/10/2026 (domingo) + 20 = 24/10/2026 (sábado) → 26/10 (segunda).
    expect(deadline({ tipo_carta: 'citacao_execucao', data_inicio: '2026-10-04' })?.prazo).toBe(
      '2026-10-26',
    );
  });
});

it('sem tipo reconhecido ou sem data, nenhuma regra se aplica', () => {
  expect(deadline({ tipo_carta: 'cobranca', data_inicio: '2026-10-01' })).toBeUndefined();
  expect(deadline({ tipo_carta: 'citacao_tribunal' })).toBeUndefined();
});
