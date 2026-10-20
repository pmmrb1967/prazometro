import {
  daysBetween,
  evaluateRule,
  type CalendarEvent,
  type Facts,
  type IsoDate,
  type Milestone,
  type Rule,
  type RuleResult,
} from '@prazometro/engine';
import type { Purchase } from '../../db';
import { RULE_IDS } from './rules';

// Estado da garantia de uma compra. Todas as datas vêm do motor de regras; aqui só se escolhe
// que regra mostrar e se traduz o resultado em linguagem simples.

export type WarrantyState = 'ativa' | 'a_terminar' | 'terminada' | 'nao_coberta';

export type Evaluated = { rule: Rule; result: RuleResult };

export type WarrantyStatus = {
  estado: WarrantyState;
  /** Porque é que a compra não está coberta (só quando estado = nao_coberta). */
  motivos: string[];
  principal?: Evaluated;
  fim?: IsoDate;
  diasRestantes?: number;
  /** De 0 (entrega) a 1 (fim da garantia). */
  progresso?: number;
  proximoMarco?: Milestone;
  /** Prazos que correm depois de comunicar o defeito à loja. */
  aposComunicacao: Evaluated[];
};

/** Dias antes do fim em que a garantia passa a "a terminar". */
export const ENDING_SOON_DAYS = 60;

export function purchaseFacts(p: Purchase): Facts {
  return {
    tipo_vendedor: p.tipo_vendedor,
    uso: p.uso,
    estado: p.estado,
    acordo_18_meses: p.estado === 'usado' ? (p.acordo_18_meses ?? 'nao_sei') : undefined,
    data_compra: p.data_compra,
    data_entrega: p.data_entrega,
    data_comunicacao: p.data_comunicacao,
    data_entrega_substituto: p.data_entrega_substituto,
  };
}

const REASONS: Record<string, string> = {
  tipo_vendedor:
    'Comprou a um particular. A garantia legal só se aplica a compras feitas a lojas ou empresas.',
  uso: 'Comprou para uso profissional. A garantia legal do consumidor só se aplica a compras para uso pessoal.',
  data_compra:
    'A compra é anterior a 1 de janeiro de 2022 e segue a lei anterior (Decreto-Lei n.º 67/2003), que a app não calcula.',
  data_entrega: 'Falta a data de entrega do bem.',
};

export function warrantyStatus(
  p: Purchase,
  rules: Record<string, Rule>,
  today: IsoDate,
): WarrantyStatus {
  const facts = purchaseFacts(p);
  const run = (id: string): Evaluated => ({
    rule: rules[id]!,
    result: evaluateRule(rules[id]!, facts, today),
  });

  const aposComunicacao = [RULE_IDS.reparacao, RULE_IDS.caducidade]
    .map(run)
    .filter((e) => e.result.aplica);

  const candidates = [RULE_IDS.substituicao, RULE_IDS.geral, RULE_IDS.reduzido].map(run);
  const principal = candidates.find((e) => e.result.aplica);

  if (!principal) {
    const geral = candidates[1]!.result;
    const motivos = geral.falhas.map((f) => REASONS[f]).filter((m): m is string => !!m);
    return { estado: 'nao_coberta', motivos, aposComunicacao };
  }

  const fim = principal.result.prazo!;
  const inicio = (facts[principal.rule.inicio] as IsoDate | undefined) ?? p.data_entrega;
  const total = daysBetween(inicio, fim);
  const diasRestantes = daysBetween(today, fim);
  const progresso = total > 0 ? Math.min(1, Math.max(0, daysBetween(inicio, today) / total)) : 1;
  const proximoMarco = principal.result.marcos.find((m) => m.data >= today);

  const estado: WarrantyState =
    diasRestantes < 0 ? 'terminada' : diasRestantes <= ENDING_SOON_DAYS ? 'a_terminar' : 'ativa';

  return {
    estado,
    motivos: [],
    principal,
    fim,
    diasRestantes,
    progresso,
    proximoMarco,
    aposComunicacao,
  };
}

/** Eventos para o calendário: só datas a partir de hoje, com os alarmes que as regras indicam. */
export function calendarEvents(
  p: Purchase,
  status: WarrantyStatus,
  today: IsoDate,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const evaluated = [...(status.principal ? [status.principal] : []), ...status.aposComunicacao];

  for (const { rule, result } of evaluated) {
    if (result.prazo && result.prazo >= today) {
      events.push({
        uid: `${p.id}-${rule.id}`,
        data: result.prazo,
        titulo: `${rule.titulo}: ${p.produto}`,
        descricao: `${p.produto}, comprado em ${p.loja}. ${rule.descricao}`,
        alarmes_dias_antes: rule.prazo.alertas_dias_antes,
      });
    }
    for (const m of result.marcos) {
      if (m.data < today) continue;
      const def = rule.marcos?.find((x) => x.id === m.id);
      events.push({
        uid: `${p.id}-${rule.id}-${m.id}`,
        data: m.data,
        titulo: `${p.produto}: ${m.id === 'rejeicao' ? 'fim dos primeiros 30 dias' : 'fim da presunção do defeito'}`,
        descricao: m.texto,
        alarmes_dias_antes: def?.alerta_dias_antes !== undefined ? [def.alerta_dias_antes] : [],
      });
    }
  }
  return events.sort((a, b) => a.data.localeCompare(b.data));
}
