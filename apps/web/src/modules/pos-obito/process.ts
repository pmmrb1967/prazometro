import {
  daysBetween,
  evaluateRule,
  type CalendarEvent,
  type IsoDate,
  type Rule,
} from '@prazometro/engine';
import type { AssetType, DeathProcess, StepState } from '../../db';
import { STEPS, type Step } from './steps';

// Liga o processo de uma família aos passos e às regras. Os prazos saem sempre do motor.

export const ASSET_TYPES: [AssetType, string][] = [
  ['conta', 'Conta ou aplicação no banco'],
  ['imovel', 'Casa ou terreno'],
  ['veiculo', 'Carro ou mota'],
  ['seguro', 'Seguro'],
  ['contrato', 'Contrato ou subscrição (telemóvel, luz, água, gás, televisão)'],
  ['outro', 'Outro'],
];

/** Carta sugerida para cada tipo de bem. */
export const ASSET_LETTER: Partial<Record<AssetType, string>> = {
  conta: 'pos-obito.comunicacao-banco',
  seguro: 'pos-obito.comunicacao-seguradora',
  contrato: 'pos-obito.cancelamento-contrato',
};

export type StepView = {
  step: Step;
  estado: StepState;
  rule?: Rule;
  prazo?: IsoDate;
  /** Dias até ao fim do prazo (negativo se já passou). */
  faltam?: number;
};

/**
 * Factos para o motor. Sem a data do registo do óbito, os prazos que contam do registo contam da
 * data do óbito, que é sempre igual ou anterior: na dúvida, a data mais cedo.
 */
export function factsOf(p: DeathProcess) {
  return {
    data_obito: p.data_obito,
    data_registo_obito: p.data_registo_obito ?? p.data_obito,
  };
}

export function stepViews(p: DeathProcess, rules: Rule[], today: IsoDate): StepView[] {
  const facts = factsOf(p);
  return STEPS.map((step) => {
    const estado = p.passos[step.id]?.estado ?? 'por_fazer';
    const rule = step.regra ? rules.find((r) => r.id === step.regra) : undefined;
    if (step.regra && !rule) throw new Error(`Regra em falta: ${step.regra}`);
    const prazo = rule ? evaluateRule(rule, facts, today).prazo : undefined;
    return {
      step,
      estado,
      rule,
      prazo,
      faltam: prazo ? daysBetween(today, prazo) : undefined,
    };
  });
}

/** Próximo passo por fazer com prazo ainda a correr (o mais urgente). */
export function nextDeadline(views: StepView[]): StepView | undefined {
  return views
    .filter((v) => v.estado === 'por_fazer' && v.prazo && v.faltam! >= 0)
    .sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0];
}

export function progress(views: StepView[]): { feitos: number; total: number } {
  const relevant = views.filter((v) => v.estado !== 'nao_aplica');
  return { feitos: relevant.filter((v) => v.estado === 'feito').length, total: relevant.length };
}

/** Lembretes para o calendário: só passos por fazer com prazo no futuro. */
export function calendarEvents(
  p: DeathProcess,
  views: StepView[],
  today: IsoDate,
): CalendarEvent[] {
  return views
    .filter((v) => v.estado === 'por_fazer' && v.prazo && v.prazo >= today && v.rule)
    .map((v) => ({
      uid: `${p.id}-${v.step.id}`,
      data: v.prazo!,
      titulo: `Prazo: ${v.step.titulo}`,
      descricao: v.rule!.descricao,
      alarmes_dias_antes: v.rule!.prazo.alertas_dias_antes,
    }));
}
