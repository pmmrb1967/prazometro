// Gera rules/schema/regra.schema.json a partir do esquema zod do motor.
import { writeFileSync } from 'node:fs';
import { ruleJsonSchema } from '@prazometro/engine';
import { SCHEMA_PATH, schemaFileContent } from './rule-schema';

writeFileSync(SCHEMA_PATH, schemaFileContent(ruleJsonSchema()));
console.log(`Escrito ${SCHEMA_PATH}`);
