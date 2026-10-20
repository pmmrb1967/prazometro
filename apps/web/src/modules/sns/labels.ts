import type { Area, Priority, WaitType } from '../../db';

// Textos simples para as escolhas do formulário e para mostrar os pedidos.

export const TYPES: [WaitType, string][] = [
  ['csp_consulta', 'Uma consulta no centro de saúde, pedida por mim'],
  ['csp_consulta_servicos', 'Uma consulta no centro de saúde, pedida pelo hospital ou pelo SNS 24'],
  ['renovacao_medicacao', 'A renovação das receitas da medicação crónica'],
  ['documentos_csp', 'Um relatório ou outro documento do médico de família'],
  ['consulta_hospitalar', 'A primeira consulta no hospital, pedida pelo médico de família'],
  ['exame', 'Um exame ou tratamento (por exemplo, TAC, ressonância, colonoscopia)'],
  ['cirurgia', 'Uma cirurgia ou tratamento programado no hospital'],
];

export const TYPE_SHORT: Record<WaitType, string> = {
  csp_consulta: 'Consulta no centro de saúde',
  csp_consulta_servicos: 'Consulta no centro de saúde',
  renovacao_medicacao: 'Renovação de receitas',
  documentos_csp: 'Documento do centro de saúde',
  consulta_hospitalar: 'Primeira consulta no hospital',
  exame: 'Exame ou tratamento',
  cirurgia: 'Cirurgia',
};

export const AREAS: [Area, string][] = [
  ['geral', 'Nenhuma destas'],
  ['oncologica', 'Doença oncológica (cancro), suspeita ou confirmada'],
  ['cardiaca', 'Doença do coração, suspeita ou confirmada'],
];

export const PRIORITIES: Record<Priority, string> = {
  muito_prioritaria: 'Muito prioritária',
  prioritaria: 'Prioritária',
  normal: 'Normal',
  nao_sei: 'Não sei',
};

export const EXAMS: [string, string][] = [
  ['tac', 'TAC (tomografia computorizada)'],
  ['ressonancia', 'Ressonância magnética'],
  ['endoscopia', 'Endoscopia ou colonoscopia'],
  ['medicina_nuclear', 'Exame de medicina nuclear (por exemplo, cintigrafia, densitometria óssea)'],
  ['cateterismo', 'Cateterismo cardíaco'],
  ['pacemaker', 'Colocação de pacemaker'],
  ['angiografia', 'Angiografia'],
  ['radioterapia', 'Radioterapia'],
  ['outro', 'Outro exame'],
];

/** As prioridades que a portaria prevê para cada tipo (nas cirurgias não há "muito prioritária"). */
export function priorityOptions(tipo: WaitType): Priority[] {
  if (tipo === 'cirurgia') return ['prioritaria', 'normal', 'nao_sei'];
  if (tipo === 'consulta_hospitalar')
    return ['muito_prioritaria', 'prioritaria', 'normal', 'nao_sei'];
  return [];
}

export function needsArea(tipo: WaitType) {
  return tipo === 'consulta_hospitalar' || tipo === 'cirurgia';
}

/** Exames e cirurgias contam da indicação do médico; o resto conta do pedido. */
export function startField(tipo: WaitType): 'data_pedido' | 'data_indicacao' {
  return tipo === 'exame' || tipo === 'cirurgia' ? 'data_indicacao' : 'data_pedido';
}

export function startLabel(tipo: WaitType): { label: string; hint: string } {
  switch (tipo) {
    case 'consulta_hospitalar':
      return {
        label: 'Data em que o médico de família fez o pedido',
        hint: 'É a data em que o pedido ficou registado no sistema. Pode vê-la na App SNS ou na área pessoal do SNS 24, ou perguntar no centro de saúde.',
      };
    case 'exame':
      return {
        label: 'Data em que o médico indicou o exame ou tratamento',
        hint: 'Normalmente é a data da consulta em que o médico decidiu fazer o exame.',
      };
    case 'cirurgia':
      return {
        label: 'Data da indicação para cirurgia',
        hint: 'É a data em que foi inscrito na lista de espera para cirurgia. Pode vê-la na App SNS ou na área pessoal do SNS 24.',
      };
    default:
      return {
        label: 'Data em que fez o pedido',
        hint: 'O dia em que o centro de saúde recebeu o pedido.',
      };
  }
}
