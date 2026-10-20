import { addDays, addMonths, addYears, type IsoDate } from '../date';
import { evaluateConditions, type Facts } from '../conditions';
import { computeDeadline } from '../deadlines';
import type { Rule } from './schema';
import { verificationStatus, type VerificationStatus } from './verification';

export type Milestone = { id: string; data: IsoDate; texto: string };

export type Alert = {
  data: IsoDate;
  tipo: 'marco' | 'prazo';
  ref: string;
  texto: string;
};

export type RuleResult = {
  regra: string;
  aplica: boolean;
  /** Campos dos factos que não cumprem as condições. */
  falhas: string[];
  prazo?: IsoDate;
  marcos: Milestone[];
  alertas: Alert[];
  verificacao: VerificationStatus;
};

/**
 * Aplica uma regra aos factos do utilizador. `start` é o dia do evento que faz correr o prazo
 * (por exemplo, a entrega do bem); `today` serve só para o estado de verificação da regra.
 * Os marcos são datas de referência (fim de uma presunção, por exemplo) e não transitam para
 * dia útil.
 */
export function evaluateRule(rule: Rule, facts: Facts, start: IsoDate, today: IsoDate): RuleResult {
  const { ok, falhas } = evaluateConditions(rule.condicoes, facts);
  const base = { regra: rule.id, falhas, verificacao: verificationStatus(rule, today) };
  if (!ok) return { ...base, aplica: false, marcos: [], alertas: [] };

  const prazo = computeDeadline(start, rule.prazo);
  const marcos: Milestone[] = (rule.marcos ?? []).map((m) => ({
    id: m.id,
    data:
      m.unidade === 'dias'
        ? addDays(start, m.quantidade)
        : m.unidade === 'meses'
          ? addMonths(start, m.quantidade)
          : addYears(start, m.quantidade),
    texto: m.texto,
  }));

  const alertas: Alert[] = [];
  for (const m of rule.marcos ?? []) {
    if (m.alerta_dias_antes === undefined) continue;
    const marco = marcos.find((x) => x.id === m.id)!;
    alertas.push({
      data: addDays(marco.data, -m.alerta_dias_antes),
      tipo: 'marco',
      ref: m.id,
      texto: m.texto,
    });
  }
  for (const n of rule.prazo.alertas_dias_antes ?? []) {
    alertas.push({
      data: addDays(prazo, -n),
      tipo: 'prazo',
      ref: rule.id,
      texto:
        n === 0
          ? `Hoje é o último dia: ${rule.titulo}.`
          : `Faltam ${n} ${n === 1 ? 'dia' : 'dias'} para o fim do prazo: ${rule.titulo}.`,
    });
  }
  alertas.sort((a, b) => a.data.localeCompare(b.data));

  return { ...base, aplica: true, prazo, marcos, alertas };
}
