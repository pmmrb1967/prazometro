// Condições das regras: um objeto em que cada chave é um campo dos factos do utilizador.
// Todas as chaves têm de se verificar (E). O valor pode ser:
// - um valor simples: o campo tem de ser igual  → { "estado": "novo" }
// - um operador: { "em": [...] }, { "nao_em": [...] }, { "diferente": x },
//   { "min": n }, { "max": n }, { "existe": true|false }
//   (min e max aceitam números ou datas AAAA-MM-DD)
// A chave reservada "qualquer" recebe uma lista de condições, das quais basta uma (OU).

export type Primitive = string | number | boolean | null;

export type Operator = {
  igual?: Primitive;
  diferente?: Primitive;
  em?: Primitive[];
  nao_em?: Primitive[];
  min?: number | string;
  max?: number | string;
  existe?: boolean;
};

export type Conditions = {
  qualquer?: Conditions[];
  [field: string]: Primitive | Operator | Conditions[] | undefined;
};

export type Facts = Record<string, Primitive | undefined>;

export type ConditionResult = { ok: boolean; falhas: string[] };

function isOperator(value: unknown): value is Operator {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compare(a: Primitive | undefined, b: number | string): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return null;
}

function checkOperator(value: Primitive | undefined, op: Operator): boolean {
  const present = value !== undefined && value !== null;
  if (op.existe !== undefined && op.existe !== present) return false;
  if ('igual' in op && value !== op.igual) return false;
  if ('diferente' in op && value === op.diferente) return false;
  if (op.em && (value === undefined || !op.em.includes(value))) return false;
  if (op.nao_em && value !== undefined && op.nao_em.includes(value)) return false;
  if (op.min !== undefined) {
    const c = compare(value, op.min);
    if (c === null || c < 0) return false;
  }
  if (op.max !== undefined) {
    const c = compare(value, op.max);
    if (c === null || c > 0) return false;
  }
  return true;
}

export function evaluateConditions(conditions: Conditions, facts: Facts): ConditionResult {
  const falhas: string[] = [];
  for (const [field, expected] of Object.entries(conditions)) {
    if (expected === undefined) continue;
    if (field === 'qualquer') {
      const options = expected as Conditions[];
      if (!options.some((c) => evaluateConditions(c, facts).ok)) falhas.push('qualquer');
      continue;
    }
    const value = facts[field];
    const ok = isOperator(expected)
      ? checkOperator(value, expected as Operator)
      : value === expected;
    if (!ok) falhas.push(field);
  }
  return { ok: falhas.length === 0, falhas };
}
