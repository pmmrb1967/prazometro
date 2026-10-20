// Valida todas as regras (rules/) e modelos de carta (templates/) e confirma que o
// JSON Schema gerado está atualizado. Falha (código 1) se houver erros.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { ruleJsonSchema, todayInLisbon, validateRepository } from '@prazometro/engine';
import { SCHEMA_PATH, schemaFileContent } from './rule-schema';

function list(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'schema') return [];
    if (statSync(path).isDirectory()) return list(path, ext);
    return name.endsWith(ext) ? [path.split(sep).join('/')] : [];
  });
}

const read = (path: string) => ({ path, content: readFileSync(path, 'utf8') });
const report = validateRepository(
  list('rules', '.json').map(read),
  list('templates', '.md').map(read),
  todayInLisbon(),
);

const current = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf8') : '';
if (current !== schemaFileContent(ruleJsonSchema())) {
  report.erros.push(`${SCHEMA_PATH} está desatualizado: corra "npm run schema:rules"`);
}

for (const a of report.avisos) console.warn(`aviso: ${a}`);
for (const e of report.erros) console.error(`erro: ${e}`);
console.log(
  `${report.regras} regra(s) e ${report.modelos} modelo(s) de carta; ${report.erros.length} erro(s), ${report.avisos.length} aviso(s).`,
);
if (report.erros.length) process.exit(1);
