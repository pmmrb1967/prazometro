import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { IsoDateSchema, MODULES, SourceSchema } from '../rules/schema';

// Modelos de carta em templates/<modulo>/<id>.md: cabeçalho YAML entre "---" com os metadados
// (fonte legal e data de verificação, como as regras) e o corpo em Markdown com {{campo}}.

export const TemplateMetaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/),
    modulo: z.enum(MODULES),
    titulo: z.string().min(1),
    campos: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9_]+$/),
            rotulo: z.string().min(1),
            obrigatorio: z.boolean().default(true),
          })
          .strict(),
      )
      .min(1),
    fontes: z
      .array(SourceSchema)
      .min(1, { message: 'Um modelo de carta sem fonte não pode ser publicado' }),
    verificado_em: IsoDateSchema,
    verificado_por: z.string().min(1),
    estado: z.enum(['publicada', 'a_rever']),
  })
  .strict();

export type TemplateMeta = z.infer<typeof TemplateMetaSchema>;
export type Template = { meta: TemplateMeta; body: string };

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const FIELD_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

export class TemplateError extends Error {}

export function parseTemplate(source: string): Template {
  const m = FRONT_MATTER_RE.exec(source);
  if (!m) throw new TemplateError('Falta o cabeçalho entre "---" no início do modelo');
  const meta = TemplateMetaSchema.safeParse(parseYaml(m[1]!));
  if (!meta.success) {
    throw new TemplateError(
      meta.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return { meta: meta.data, body: m[2]!.trim() };
}

/** Campos {{campo}} usados no corpo, sem repetições, pela ordem em que aparecem. */
export function templateFields(body: string): string[] {
  return [...new Set([...body.matchAll(FIELD_RE)].map((x) => x[1]!))];
}

/** Problemas de coerência entre os campos declarados e os usados no corpo. */
export function checkTemplate({ meta, body }: Template): string[] {
  const used = new Set(templateFields(body));
  const declared = new Set(meta.campos.map((c) => c.id));
  const problems: string[] = [];
  for (const f of used)
    if (!declared.has(f)) problems.push(`campo {{${f}}} usado mas não declarado`);
  for (const f of declared) if (!used.has(f)) problems.push(`campo "${f}" declarado mas não usado`);
  return problems;
}

export type FilledTemplate = { texto: string; em_falta: string[] };

/**
 * Preenche o corpo com os valores dados. Campos obrigatórios em falta ficam assinalados como
 * "[rótulo]" no texto e listados em `em_falta`; os opcionais em falta ficam vazios.
 */
export function fillTemplate(
  { meta, body }: Template,
  values: Record<string, string>,
): FilledTemplate {
  const em_falta: string[] = [];
  const texto = body.replace(FIELD_RE, (_, id: string) => {
    const value = values[id]?.trim();
    if (value) return value;
    const campo = meta.campos.find((c) => c.id === id);
    if (campo && !campo.obrigatorio) return '';
    if (!em_falta.includes(id)) em_falta.push(id);
    return `[${campo?.rotulo ?? id}]`;
  });
  return { texto, em_falta };
}
