import { RuleSchema, type Rule } from '@prazometro/engine';

// Regras do módulo, lidas de rules/sns/ no momento do build e validadas ao arrancar.

const files = import.meta.glob<{ default: unknown }>('../../../../../rules/sns/*.json', {
  eager: true,
});

export const SNS_RULES: Rule[] = Object.values(files).map((m) => RuleSchema.parse(m.default));

export const P153_URL =
  'https://diariodarepublica.pt/dr/legislacao-consolidada/portaria/2017-953449980';
export const P135_URL = 'https://files.diariodarepublica.pt/1s/2026/03/06300/0000800019.pdf';
