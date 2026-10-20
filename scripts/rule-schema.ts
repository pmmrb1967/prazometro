export const SCHEMA_PATH = 'rules/schema/regra.schema.json';

export function schemaFileContent(schema: object): string {
  return (
    JSON.stringify(
      {
        $id: 'https://app.prazometro.workers.dev/rules/schema/regra.schema.json',
        title: 'Regra do Prazómetro',
        description: 'Gerado a partir de packages/engine/src/rules/schema.ts. Não editar à mão.',
        ...schema,
      },
      null,
      2,
    ) + '\n'
  );
}
