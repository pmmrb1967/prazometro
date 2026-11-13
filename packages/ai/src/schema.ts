import { z } from 'zod';

// Esquema único da resposta de todos os fornecedores (none, workers-ai, gemini, claude).
// A IA só extrai e resume: nunca calcula prazos nem decide direitos (princípio 1).

export const PROVIDERS = [
  'none',
  'workers-ai',
  'gemini-admin',
  'gemini-own',
  'claude-own',
] as const;
export type AiProvider = (typeof PROVIDERS)[number];

/** Modelo por defeito da Claude (configurável pela pessoa). */
export const CLAUDE_DEFAULT_MODEL = 'claude-haiku-5-5';

export const ISSUERS = [
  'at',
  'seguranca_social',
  'tribunal',
  'transito',
  'banco',
  'operadora',
  'sns',
  'camara',
  'energia_agua',
  'outro',
] as const;
export type Issuer = (typeof ISSUERS)[number];

export const ISSUER_LABELS: Record<Issuer, string> = {
  at: 'Autoridade Tributária (Finanças)',
  seguranca_social: 'Segurança Social',
  tribunal: 'Tribunal ou agente de execução',
  transito: 'Autoridade de trânsito (ANSR, PSP, GNR ou polícia municipal)',
  banco: 'Banco ou instituição de crédito',
  operadora: 'Operadora de telecomunicações',
  sns: 'Serviço Nacional de Saúde',
  camara: 'Câmara municipal ou junta de freguesia',
  energia_agua: 'Fornecedor de eletricidade, gás ou água',
  outro: 'Outra entidade',
};

/** Tipos de carta. Alguns correspondem a regras do motor (rules/cartas/). */
export const LETTER_TYPES = [
  'contraordenacao_transito',
  'audicao_previa_at',
  'citacao_tribunal',
  'cobranca',
  'liquidacao_imposto',
  'informacao',
  'outro',
] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  contraordenacao_transito: 'Multa de trânsito (auto de contraordenação)',
  audicao_previa_at: 'Finanças: projeto de decisão, para se pronunciar (audição prévia)',
  citacao_tribunal: 'Citação de um tribunal para contestar uma ação',
  cobranca: 'Pedido de pagamento de uma dívida',
  liquidacao_imposto: 'Nota de cobrança ou liquidação de imposto',
  informacao: 'Informação, sem nada a fazer',
  outro: 'Outro assunto',
};

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ExtractionSchema = z.object({
  emissor: z.enum(ISSUERS),
  /** Nome da entidade como aparece na carta (vazio se não se souber). */
  emissor_nome: z.string().max(200),
  tipo: z.enum(LETTER_TYPES),
  assunto: z.string().max(300),
  resumo: z.string().max(1500),
  /** O que a carta pede à pessoa. */
  pedido: z.string().max(800),
  /** O que acontece se não fizer nada, segundo a carta. */
  consequencias: z.string().max(800),
  /** Datas escritas na carta, com o que significam. Nunca datas calculadas. */
  datas: z.array(z.object({ data: IsoDate, descricao: z.string().max(200) })).max(12),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** JSON Schema da resposta, para a saída estruturada dos fornecedores. */
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    emissor: { type: 'string', enum: [...ISSUERS] },
    emissor_nome: { type: 'string' },
    tipo: { type: 'string', enum: [...LETTER_TYPES] },
    assunto: { type: 'string' },
    resumo: { type: 'string' },
    pedido: { type: 'string' },
    consequencias: { type: 'string' },
    datas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'AAAA-MM-DD' },
          descricao: { type: 'string' },
        },
        required: ['data', 'descricao'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'emissor',
    'emissor_nome',
    'tipo',
    'assunto',
    'resumo',
    'pedido',
    'consequencias',
    'datas',
  ],
  additionalProperties: false,
} as const;
