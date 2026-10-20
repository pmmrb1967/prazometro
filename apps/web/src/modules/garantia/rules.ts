import { RuleSchema, type Rule } from '@prazometro/engine';

// Regras do módulo, lidas de rules/garantia/ no momento do build e validadas ao arrancar.
// Uma regra inválida não chega a produção: o `validate:rules` corre na CI antes da publicação.

const files = import.meta.glob<{ default: unknown }>('../../../../../rules/garantia/*.json', {
  eager: true,
});

export const GARANTIA_RULES: Record<string, Rule> = Object.fromEntries(
  Object.values(files).map((m) => {
    const rule = RuleSchema.parse(m.default);
    return [rule.id, rule];
  }),
);

export function rule(id: string): Rule {
  const r = GARANTIA_RULES[id];
  if (!r) throw new Error(`Regra em falta: ${id}`);
  return r;
}

export const RULE_IDS = {
  geral: 'garantia.prazo-geral',
  reduzido: 'garantia.usados-prazo-reduzido',
  substituicao: 'garantia.substituicao',
  reparacao: 'garantia.prazo-reparacao',
  caducidade: 'garantia.caducidade-direitos',
} as const;
