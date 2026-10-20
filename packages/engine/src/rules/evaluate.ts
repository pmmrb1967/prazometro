import { addDays, addMonths, addYears, isValidDate, type IsoDate } from '../date';
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
 * Aplica uma regra aos factos do utilizador. O prazo corre a partir da data guardada no facto
 * indicado em `rule.inicio` (por exemplo, `data_entrega`); se faltar ou for inválida, a regra
 * não se aplica. `today` serve só para o estado de verificação da regra.
 * Os marcos são datas de referência (fim de uma presunção, por exemplo) e não transitam para
 * dia útil.
 */
export function evaluateRule(rule: Rule, facts: Facts, today: IsoDate): RuleResult {
  const { falhas } = evaluateConditions(rule.condicoes, facts);
  const start = facts[rule.inicio];
  if (typeof start !== 'string' || !isValidDate(start)) falhas.push(rule.inicio);
  const base = { regra: rule.id, falhas, verificacao: verificationStatus(rule, today) };
  if (falhas.length > 0) return { ...base, aplica: false, marcos: [], alertas: [] };

  const from = start as IsoDate;
  const prazo = computeDeadline(from, rule.prazo);
  const marcos: Milestone[] = (rule.marcos ?? []).map((m) => ({
    id: m.id,
    data:
      m.unidade === 'dias'
        ? addDays(from, m.quantidade)
        : m.unidade === 'meses'
          ? addMonths(from, m.quantidade)
          : addYears(from, m.quantidade),
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
