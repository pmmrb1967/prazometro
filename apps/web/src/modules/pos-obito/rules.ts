import { RuleSchema, type Rule } from '@prazometro/engine';

// Regras do módulo, lidas de rules/pos-obito/ no momento do build e validadas ao arrancar.

const files = import.meta.glob<{ default: unknown }>('../../../../../rules/pos-obito/*.json', {
  eager: true,
});

export const POS_OBITO_RULES: Rule[] = Object.values(files).map((m) => RuleSchema.parse(m.default));

export const CODIGO_CIVIL_URL =
  'https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075';
export const OBITO_AT_URL =
  'https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Dados_pessoais_familia/Familia/Obito';
