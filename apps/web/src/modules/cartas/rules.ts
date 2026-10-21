import { evaluateRule, RuleSchema, type Rule, type RuleResult } from '@prazometro/engine';
import type { ReceivedLetter } from '../../db';

// Regras do módulo, lidas de rules/cartas/ no momento do build e validadas ao arrancar.
// O prazo é sempre calculado aqui, pelo motor, e nunca pela IA (princípio 1).

const files = import.meta.glob<{ default: unknown }>('../../../../../rules/cartas/*.json', {
  eager: true,
});

export const CARTAS_RULES: Rule[] = Object.values(files).map((m) => RuleSchema.parse(m.default));

export type LetterDeadline = { rule: Rule; result: RuleResult; inicio: string };

/**
 * Prazo da carta segundo o motor, se o tipo corresponder a uma regra. Conta a partir da data
 * mais cedo entre a data da carta e a data em que foi recebida (na dúvida, a data mais cedo).
 */
export function letterDeadline(
  letter: Pick<ReceivedLetter, 'tipo' | 'data_carta' | 'data_rececao'>,
  today: string,
): LetterDeadline | undefined {
  const dates = [letter.data_carta, letter.data_rececao].filter((d): d is string => !!d).sort();
  const inicio = dates[0];
  if (!inicio) return undefined;
  for (const rule of CARTAS_RULES) {
    const result = evaluateRule(rule, { tipo_carta: letter.tipo, data_inicio: inicio }, today);
    if (result.aplica) return { rule, result, inicio };
  }
  return undefined;
}

/** O tipo de carta tem uma regra no motor? */
export const hasRule = (tipo: string) => CARTAS_RULES.some((r) => r.condicoes.tipo_carta === tipo);
