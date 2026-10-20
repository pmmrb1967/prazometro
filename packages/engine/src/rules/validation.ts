import type { IsoDate } from '../date';
import { checkTemplate, parseTemplate } from '../letters/template';
import { RuleSchema } from './schema';
import { verificationStatus } from './verification';

// Validação de todas as regras e modelos de carta do repositório (npm run validate:rules).
// Recebe o conteúdo já lido, para poder ser testada sem disco.

export type SourceFile = { path: string; content: string };

export type ValidationReport = {
  erros: string[];
  avisos: string[];
  regras: number;
  modelos: number;
};

/** Pasta do módulo a partir do caminho (rules/<modulo>/x.json ou templates/<modulo>/x.md). */
function moduleFolder(path: string): string | undefined {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts.length >= 3 ? parts[parts.length - 2] : undefined;
}

export function validateRepository(
  rules: SourceFile[],
  templates: SourceFile[],
  today: IsoDate,
): ValidationReport {
  const erros: string[] = [];
  const avisos: string[] = [];
  const templateIds = new Map<string, string>();

  for (const file of templates) {
    try {
      const t = parseTemplate(file.content);
      for (const p of checkTemplate(t)) erros.push(`${file.path}: ${p}`);
      if (templateIds.has(t.meta.id)) {
        erros.push(
          `${file.path}: id "${t.meta.id}" repetido (também em ${templateIds.get(t.meta.id)})`,
        );
      }
      templateIds.set(t.meta.id, file.path);
      if (moduleFolder(file.path) !== t.meta.modulo) {
        erros.push(`${file.path}: está fora da pasta do módulo "${t.meta.modulo}"`);
      }
      if (t.meta.verificado_em > today) erros.push(`${file.path}: verificado_em está no futuro`);
      const status = verificationStatus(t.meta, today);
      if (status !== 'verificada') avisos.push(`${file.path}: modelo ${status.replace('_', ' ')}`);
    } catch (e) {
      erros.push(`${file.path}: ${(e as Error).message}`);
    }
  }

  const ruleIds = new Map<string, string>();
  for (const file of rules) {
    let json: unknown;
    try {
      json = JSON.parse(file.content);
    } catch (e) {
      erros.push(`${file.path}: JSON inválido (${(e as Error).message})`);
      continue;
    }
    const parsed = RuleSchema.safeParse(json);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const message =
          issue.code === 'invalid_type' && issue.input === undefined
            ? 'campo obrigatório em falta'
            : issue.code === 'unrecognized_keys'
              ? `campos desconhecidos: ${issue.keys.join(', ')}`
              : issue.code === 'invalid_type'
                ? `tipo errado (esperado: ${issue.expected})`
                : issue.message;
        erros.push(`${file.path}: ${issue.path.join('.') || '(regra)'}: ${message}`);
      }
      continue;
    }
    const rule = parsed.data;
    if (ruleIds.has(rule.id)) {
      erros.push(`${file.path}: id "${rule.id}" repetido (também em ${ruleIds.get(rule.id)})`);
    }
    ruleIds.set(rule.id, file.path);
    if (moduleFolder(file.path) !== rule.modulo) {
      erros.push(`${file.path}: está fora da pasta do módulo "${rule.modulo}"`);
    }
    if (rule.verificado_em > today) erros.push(`${file.path}: verificado_em está no futuro`);
    for (const id of rule.modelos_carta) {
      if (!templateIds.has(id))
        erros.push(`${file.path}: modelo de carta "${id}" não existe em templates/`);
    }
    const status = verificationStatus(rule, today);
    if (status !== 'verificada') avisos.push(`${file.path}: regra ${status.replace('_', ' ')}`);
  }

  return { erros, avisos, regras: rules.length, modelos: templates.length };
}
