// Validação mínima das regras (Fase 0). Na Fase 1 passa a usar o esquema zod em rules/schema/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RULES_DIR = 'rules';
const REQUIRED = [
  'id',
  'modulo',
  'titulo',
  'descricao',
  'prazo',
  'fontes',
  'verificado_em',
  'verificado_por',
];

function listJson(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'schema') return [];
    if (statSync(path).isDirectory()) return listJson(path);
    return name.endsWith('.json') ? [path] : [];
  });
}

const files = listJson(RULES_DIR);
const errors = [];
for (const file of files) {
  let rule;
  try {
    rule = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${file}: JSON inválido (${e.message})`);
    continue;
  }
  for (const field of REQUIRED) {
    if (rule[field] === undefined) errors.push(`${file}: falta o campo "${field}"`);
  }
  if (Array.isArray(rule.fontes) && rule.fontes.length === 0)
    errors.push(`${file}: "fontes" está vazio`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`${files.length} regra(s) válida(s).`);
