import { describe, expect, it } from 'vitest';
import type { DeathProcess } from '../../db';
import { calendarEvents, nextDeadline, progress, stepViews } from './process';
import { POS_OBITO_RULES } from './rules';
import { STEPS } from './steps';
import { TEMPLATES } from '../../letters';

const base: DeathProcess = {
  id: 'p1',
  data_obito: '2026-09-10',
  passos: {},
  bens: [],
  criado_em: '2026-09-12',
};
const TODAY = '2026-10-21';

describe('Pós-óbito: passos e prazos', () => {
  it('todas as regras e cartas indicadas nos passos existem', () => {
    for (const s of STEPS) {
      if (s.regra) expect(POS_OBITO_RULES.map((r) => r.id)).toContain(s.regra);
      for (const c of s.cartas ?? []) expect(Object.keys(TEMPLATES)).toContain(c);
    }
  });

  it('sem data do registo, os prazos da Segurança Social contam da data do óbito', () => {
    const v = stepViews(base, POS_OBITO_RULES, TODAY);
    // 10/09/2026 + 90 dias = 09/12/2026.
    expect(v.find((x) => x.step.id === 'reembolso-funeral')?.prazo).toBe('2026-12-09');
    // Com o registo a 11/09, conta um dia mais tarde.
    const w = stepViews({ ...base, data_registo_obito: '2026-09-11' }, POS_OBITO_RULES, TODAY);
    expect(w.find((x) => x.step.id === 'reembolso-funeral')?.prazo).toBe('2026-12-10');
  });

  it('o próximo prazo é o passo por fazer que termina primeiro', () => {
    const v = stepViews(base, POS_OBITO_RULES, TODAY);
    // Participação às Finanças: fim de dezembro (31/12/2026, quinta-feira).
    expect(v.find((x) => x.step.id === 'participacao-imposto-selo')?.prazo).toBe('2026-12-31');
    expect(nextDeadline(v)?.step.id).toBe('reembolso-funeral');
    const done = stepViews(
      { ...base, passos: { 'reembolso-funeral': { estado: 'nao_aplica', atualizado_em: TODAY } } },
      POS_OBITO_RULES,
      TODAY,
    );
    expect(nextDeadline(done)?.step.id).toBe('participacao-imposto-selo');
  });

  it('o progresso não conta os passos que não se aplicam', () => {
    const v = stepViews(
      {
        ...base,
        passos: {
          bancos: { estado: 'feito', atualizado_em: TODAY },
          seguros: { estado: 'nao_aplica', atualizado_em: TODAY },
        },
      },
      POS_OBITO_RULES,
      TODAY,
    );
    expect(progress(v)).toEqual({ feitos: 1, total: STEPS.length - 1 });
  });

  it('os lembretes só incluem prazos por fazer e ainda não passados', () => {
    const events = calendarEvents(base, stepViews(base, POS_OBITO_RULES, TODAY), TODAY);
    const ids = events.map((e) => e.uid.replace('p1-', ''));
    expect(ids).not.toContain('declaracao-obito');
    expect(ids).toContain('participacao-imposto-selo');
    expect(ids).toContain('aceitacao-heranca');
  });
});
