import { z } from 'zod';
import { isValidDate } from '../date';
import type { Conditions } from '../conditions';

// Esquema das regras em rules/<modulo>/*.json. É a fonte única: o JSON Schema em
// rules/schema/regra.schema.json é gerado a partir daqui (npm run schema:rules).

export const MODULES = ['garantia', 'sns', 'cartas', 'pos-obito'] as const;

export const IsoDateSchema = z
  .string()
  .refine(isValidDate, { message: 'Data inválida (formato AAAA-MM-DD)' })
  .meta({ format: 'date' });

export const SourceSchema = z
  .object({
    titulo: z.string().min(1),
    url: z.url({ protocol: /^https$/ }),
    artigo: z.string().min(1),
  })
  .strict();

const PrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const OperatorSchema = z
  .object({
    igual: PrimitiveSchema.optional(),
    diferente: PrimitiveSchema.optional(),
    em: z.array(PrimitiveSchema).min(1).optional(),
    nao_em: z.array(PrimitiveSchema).min(1).optional(),
    min: z.union([z.number(), z.string()]).optional(),
    max: z.union([z.number(), z.string()]).optional(),
    existe: z.boolean().optional(),
  })
  .strict()
  .refine((op) => Object.keys(op).length > 0, { message: 'Operador vazio' });

export const ConditionsSchema: z.ZodType<Conditions> = z.lazy(() =>
  z
    .object({ qualquer: z.array(ConditionsSchema).min(2).optional() })
    .catchall(z.union([PrimitiveSchema, OperatorSchema])),
);

const UnitSchema = z.enum(['dias', 'meses', 'anos']);
const DaysBeforeSchema = z.number().int().min(0).max(365);

export const DeadlineSchema = z
  .object({
    quantidade: z.number().int().positive(),
    unidade: UnitSchema,
    contagem: z.enum(['corridos', 'uteis']),
    transita_dia_util: z.boolean(),
    transicao: z.enum(['domingo_feriado', 'sabado_domingo_feriado']).optional(),
    alertas_dias_antes: z.array(DaysBeforeSchema).optional(),
  })
  .strict()
  .refine((p) => p.contagem === 'corridos' || p.unidade === 'dias', {
    message: 'A contagem em dias úteis só se aplica a dias',
    path: ['contagem'],
  })
  .refine((p) => p.transicao === undefined || p.transita_dia_util, {
    message: '"transicao" só faz sentido com "transita_dia_util": true',
    path: ['transicao'],
  });

export const MilestoneSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    quantidade: z.number().int().positive(),
    unidade: UnitSchema,
    alerta_dias_antes: DaysBeforeSchema.optional(),
    texto: z.string().min(1),
  })
  .strict();

export const RuleSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, {
      message: 'Formato "modulo.nome-da-regra"',
    }),
    modulo: z.enum(MODULES),
    titulo: z.string().min(1),
    descricao: z.string().min(1),
    condicoes: ConditionsSchema,
    prazo: DeadlineSchema,
    marcos: z.array(MilestoneSchema).optional(),
    fontes: z.array(SourceSchema).min(1, { message: 'Uma regra sem fonte não pode ser publicada' }),
    modelos_carta: z.array(z.string().min(1)),
    verificado_em: IsoDateSchema,
    verificado_por: z.string().min(1),
    estado: z.enum(['publicada', 'a_rever']),
    notas: z.string().optional(),
  })
  .strict()
  .refine((r) => r.id.startsWith(`${r.modulo}.`), {
    message: 'O id tem de começar pelo módulo (por exemplo, "garantia.")',
    path: ['id'],
  })
  .refine((r) => new Set((r.marcos ?? []).map((m) => m.id)).size === (r.marcos ?? []).length, {
    message: 'Há marcos com o mesmo id',
    path: ['marcos'],
  });

export type Rule = z.infer<typeof RuleSchema>;
export type Source = z.infer<typeof SourceSchema>;

export function ruleJsonSchema() {
  return z.toJSONSchema(RuleSchema, { target: 'draft-2020-12', unrepresentable: 'any' });
}
