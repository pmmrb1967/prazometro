// Uma "tarefa" é o que se pede à IA: o prompt e o esquema JSON da resposta. Todos os
// fornecedores recebem a mesma tarefa (CLAUDE.md, secção IA).

export type TaskId = 'carta' | 'fatura';

export type AiTask = {
  id: TaskId;
  /** Nome curto do esquema (Workers AI exige um). */
  nome: string;
  system: string;
  user: (text: string) => string;
  schema: Record<string, unknown>;
};
