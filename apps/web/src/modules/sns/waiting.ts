import {
  daysBetween,
  evaluateRule,
  type CalendarEvent,
  type Facts,
  type IsoDate,
  type Rule,
} from '@prazometro/engine';
import type { Priority, WaitRequest } from '../../db';
import { PRIORITIES } from './labels';

// Estado da espera de um pedido no SNS. O tempo máximo vem sempre do motor de regras; aqui só se
// compara com hoje, com a data marcada ou com a data em que foi atendido.

export type WaitState =
  | 'dentro'
  | 'a_terminar'
  | 'ultrapassado'
  | 'cumprido'
  | 'cumprido_tarde'
  | 'sem_prioridade'
  | 'sem_tmrg';

export type Possibility = { prioridade: Priority; rule: Rule; prazo: IsoDate };

export type WaitStatus = {
  estado: WaitState;
  rule?: Rule;
  prazo?: IsoDate;
  /** Dias até ao fim do tempo máximo (negativo se já passou). */
  diasRestantes?: number;
  /** Dias de atraso: hoje, na data marcada ou no dia em que foi atendido. */
  diasAtraso?: number;
  progresso?: number;
  /** A data marcada fica depois do tempo máximo. */
  marcadaDepois?: number;
  /** Com prioridade "não sei": o tempo máximo em cada prioridade possível. */
  possibilidades: Possibility[];
};

/** Dias antes do fim em que a espera passa a "a terminar". */
export const ENDING_SOON_DAYS = 7;

export function requestFacts(r: WaitRequest, prioridade = r.prioridade): Facts {
  return {
    tipo: r.tipo,
    area: r.area ?? 'geral',
    prioridade,
    exame: r.exame,
    data_pedido: r.data_pedido,
    data_indicacao: r.data_indicacao,
  };
}

function applying(rules: Rule[], facts: Facts, today: IsoDate) {
  for (const rule of rules) {
    const result = evaluateRule(rule, facts, today);
    if (result.aplica) return { rule, prazo: result.prazo! };
  }
  return undefined;
}

export function waitStatus(r: WaitRequest, rules: Rule[], today: IsoDate): WaitStatus {
  if (r.prioridade === 'nao_sei') {
    const possibilidades: Possibility[] = [];
    for (const p of ['muito_prioritaria', 'prioritaria', 'normal'] as const) {
      const a = applying(rules, requestFacts(r, p), today);
      if (a) possibilidades.push({ prioridade: p, ...a });
    }
    return {
      estado: possibilidades.length ? 'sem_prioridade' : 'sem_tmrg',
      possibilidades,
    };
  }

  const a = applying(rules, requestFacts(r), today);
  if (!a) return { estado: 'sem_tmrg', possibilidades: [] };

  const inicio = (r.data_indicacao ?? r.data_pedido)!;
  const total = daysBetween(inicio, a.prazo);
  const progresso = total > 0 ? Math.min(1, Math.max(0, daysBetween(inicio, today) / total)) : 1;
  const base = { rule: a.rule, prazo: a.prazo, progresso, possibilidades: [] };

  if (r.realizado_em) {
    const atraso = daysBetween(a.prazo, r.realizado_em);
    return atraso > 0
      ? { ...base, estado: 'cumprido_tarde', diasAtraso: atraso, progresso: 1 }
      : { ...base, estado: 'cumprido', progresso: 1 };
  }

  const diasRestantes = daysBetween(today, a.prazo);
  const marcadaDepois =
    r.data_marcada && r.data_marcada > a.prazo ? daysBetween(a.prazo, r.data_marcada) : undefined;
  const estado: WaitState =
    diasRestantes < 0
      ? 'ultrapassado'
      : diasRestantes <= ENDING_SOON_DAYS
        ? 'a_terminar'
        : 'dentro';
  return {
    ...base,
    estado,
    diasRestantes,
    diasAtraso: diasRestantes < 0 ? -diasRestantes : undefined,
    marcadaDepois,
  };
}

// Na portaria estes prazos são de 72 horas; as regras usam 3 dias (ver as notas das regras).
const IN_HOURS = new Set(['sns.csp-renovacao-medicacao', 'sns.csp-documentos']);

/** "120 dias seguidos" ou "15 dias úteis", para mostrar e para a carta. */
export function tmrgText(rule: Rule): string {
  const { quantidade, contagem } = rule.prazo;
  if (IN_HOURS.has(rule.id)) return '72 horas';
  return `${quantidade} dias ${contagem === 'uteis' ? 'úteis' : 'seguidos'}`;
}

export function priorityText(p?: Priority): string | undefined {
  return p && p !== 'nao_sei' ? PRIORITIES[p].toLowerCase() : undefined;
}

/** Lembrete para o fim do tempo máximo, só se ainda estiver à espera e a data for futura. */
export function calendarEvents(r: WaitRequest, s: WaitStatus, today: IsoDate): CalendarEvent[] {
  if (!s.rule || !s.prazo || r.realizado_em || s.prazo < today) return [];
  return [
    {
      uid: `${r.id}-${s.rule.id}`,
      data: s.prazo,
      titulo: `Fim do tempo máximo de espera: ${r.descricao}`,
      descricao: `${s.rule.titulo}. ${s.rule.descricao} Se ainda não foi atendido, pode reclamar.`,
      alarmes_dias_antes: s.rule.prazo.alertas_dias_antes,
    },
  ];
}
