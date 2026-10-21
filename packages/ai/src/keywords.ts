import { findDates } from './dates';
import type { Extraction, Issuer, LetterType } from './schema';

// Fornecedor "none": sem IA, só palavras-chave. Corre no dispositivo, com o texto original,
// e é sempre o recurso quando um fornecedor de IA falha.

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pistas por emissor: [texto, peso]. Ganha o emissor com mais peso. */
const ISSUER_CLUES: Record<Exclude<Issuer, 'outro'>, [string, number][]> = {
  at: [
    ['autoridade tributaria', 5],
    ['servico de financas', 5],
    ['portal das financas', 3],
    ['direcao de financas', 4],
    ['imposto municipal sobre imoveis', 3],
    ['imi', 1],
    ['irs', 2],
    ['iva', 1],
    ['iuc', 2],
    ['execucao fiscal', 3],
    ['liquidacao', 1],
    ['nota de cobranca', 1],
    ['direito de audicao', 2],
    ['lei geral tributaria', 3],
    ['cppt', 2],
  ],
  seguranca_social: [
    ['seguranca social', 5],
    ['instituto da seguranca social', 3],
    ['seg-social', 4],
    ['niss', 2],
    ['seguranca social direta', 3],
    ['prestacao social', 2],
    ['subsidio de desemprego', 2],
    ['contribuicoes', 1],
    ['igfss', 4],
  ],
  tribunal: [
    ['tribunal', 4],
    ['juizo', 3],
    ['citacao', 3],
    ['citado', 2],
    ['agente de execucao', 4],
    ['solicitador de execucao', 4],
    ['injuncao', 4],
    ['balcao nacional de injuncoes', 4],
    ['mandatario judicial', 2],
    ['codigo de processo civil', 2],
    ['contestar', 2],
    ['penhora', 2],
  ],
  transito: [
    ['autoridade nacional de seguranca rodoviaria', 5],
    ['ansr', 5],
    ['auto de contraordenacao', 4],
    ['contraordenacao rodoviaria', 4],
    ['codigo da estrada', 4],
    ['matricula', 2],
    ['velocidade', 2],
    ['estacionamento', 2],
    ['psp', 2],
    ['gnr', 2],
    ['policia municipal', 3],
    ['coima', 1],
    ['radar', 2],
  ],
  banco: [
    ['banco', 3],
    ['caixa geral de depositos', 5],
    ['millennium', 4],
    ['santander', 4],
    ['novo banco', 4],
    ['bpi', 3],
    ['credito habitacao', 3],
    ['credito pessoal', 3],
    ['cartao de credito', 2],
    ['prestacao em atraso', 2],
    ['taeg', 3],
    ['conta a ordem', 2],
    ['cofidis', 4],
  ],
  operadora: [
    ['meo', 4],
    ['nos comunicacoes', 5],
    ['vodafone', 5],
    ['digi', 3],
    ['nowo', 4],
    ['telecomunicacoes', 2],
    ['fidelizacao', 3],
    ['tarifario', 2],
    ['fibra', 1],
    ['anacom', 3],
  ],
  sns: [
    ['servico nacional de saude', 5],
    ['sns', 3],
    ['unidade local de saude', 4],
    ['uls', 2],
    ['centro de saude', 4],
    ['usf', 3],
    ['hospital', 2],
    ['taxa moderadora', 3],
    ['consulta', 1],
    ['numero de utente', 3],
    ['lista de espera', 2],
  ],
  camara: [
    ['camara municipal', 5],
    ['municipio', 3],
    ['junta de freguesia', 5],
    ['presidente da camara', 3],
    ['licenciamento', 2],
    ['taxa municipal', 2],
  ],
  energia_agua: [
    ['edp', 4],
    ['endesa', 4],
    ['galp', 3],
    ['goldenergy', 4],
    ['iberdrola', 4],
    ['eletricidade', 2],
    ['gas natural', 2],
    ['epal', 4],
    ['aguas de', 3],
    ['servicos municipalizados', 3],
    ['cpe', 2],
    ['kwh', 2],
    ['m3', 1],
    ['contador', 1],
    ['erse', 3],
  ],
};

const TYPE_CLUES: [LetterType, string[]][] = [
  [
    'contraordenacao_transito',
    ['auto de contraordenacao', 'codigo da estrada', 'ansr', 'contraordenacao rodoviaria'],
  ],
  ['audicao_previa_at', ['direito de audicao', 'audicao previa', 'projeto de decisao']],
  ['citacao_tribunal', ['citacao', 'fica citado', 'e citado', 'contestar', 'contestacao']],
  [
    'liquidacao_imposto',
    ['nota de liquidacao', 'nota de cobranca', 'demonstracao de liquidacao', 'liquidacao de'],
  ],
  [
    'cobranca',
    [
      'valor em divida',
      'divida',
      'em atraso',
      'pagamento em falta',
      'regularizar',
      'injuncao',
      'aviso de pagamento',
    ],
  ],
];

/** Pistas que indicam o que significa uma data, pelo texto à volta. */
const DATE_MEANINGS: [string[], string][] = [
  [
    [
      'data limite',
      'prazo de pagamento',
      'pagar ate',
      'ate ao dia',
      'ate a data',
      'termo do prazo',
    ],
    'Data limite indicada na carta',
  ],
  [['data da infracao', 'infracao', 'ocorrida em', 'verificada em'], 'Data da infração'],
  [['consulta', 'marcada', 'agendad', 'comparecer'], 'Data marcada'],
  [['notificacao', 'notificado em'], 'Data da notificação'],
  [['emitid', 'data de emissao', 'data do documento', 'data:'], 'Data da carta'],
  [['periodo', 'referente'], 'Período a que se refere'],
];

function issuerOf(text: string): { emissor: Issuer; nome: string } {
  const f = fold(text);
  let best: Issuer = 'outro';
  let bestScore = 0;
  for (const [issuer, clues] of Object.entries(ISSUER_CLUES) as [Issuer, [string, number][]][]) {
    let score = 0;
    for (const [clue, weight] of clues) {
      if (new RegExp(`(?<![a-z0-9])${clue}(?![a-z0-9])`).test(f)) score += weight;
    }
    if (score > bestScore) {
      best = issuer;
      bestScore = score;
    }
  }
  return { emissor: bestScore >= 3 ? best : 'outro', nome: '' };
}

function typeOf(text: string, emissor: Issuer): LetterType {
  const f = fold(text);
  for (const [type, clues] of TYPE_CLUES) {
    if (type === 'contraordenacao_transito' && emissor !== 'transito') continue;
    if (type === 'audicao_previa_at' && emissor !== 'at') continue;
    if (type === 'citacao_tribunal' && emissor !== 'tribunal') continue;
    if (type === 'liquidacao_imposto' && emissor !== 'at') continue;
    if (clues.some((c) => f.includes(c))) return type;
  }
  return 'outro';
}

function meaningOf(text: string, start: number, index: number): string {
  // Ganha a pista mais perto da data (a da mesma linha, e não a da linha anterior).
  const before = fold(text.slice(Math.max(0, start - 60), start));
  let best: { label: string; at: number } | undefined;
  for (const [clues, label] of DATE_MEANINGS) {
    for (const c of clues) {
      const at = before.lastIndexOf(c);
      if (at >= 0 && (!best || at > best.at)) best = { label, at };
    }
  }
  if (best) return best.label;
  return index === 0 ? 'Data que aparece primeiro na carta' : 'Data referida na carta';
}

const SUMMARIES: Record<LetterType, { resumo: string; pedido: string; consequencias: string }> = {
  contraordenacao_transito: {
    resumo: 'É uma notificação de uma infração ao Código da Estrada (multa de trânsito).',
    pedido:
      'Pode pagar a coima pelo valor mínimo, apresentar defesa por escrito ou, em certos casos, pedir para pagar em prestações.',
    consequencias:
      'Se não fizer nada no prazo, o processo continua e pode ter de pagar custas, além da coima e de uma eventual sanção acessória.',
  },
  audicao_previa_at: {
    resumo:
      'As Finanças informam que vão tomar uma decisão e dão-lhe a oportunidade de dizer o que pensa antes de decidirem.',
    pedido: 'Pode pronunciar-se por escrito (ou oralmente) dentro do prazo indicado na carta.',
    consequencias:
      'Se não responder, as Finanças decidem com base no que têm. Pode reagir mais tarde, mas com outros prazos.',
  },
  citacao_tribunal: {
    resumo:
      'É uma citação: alguém pôs uma ação em tribunal contra si e o tribunal está a avisá-lo.',
    pedido: 'Pode contestar a ação dentro do prazo, normalmente com um advogado.',
    consequencias:
      'Se não contestar no prazo, os factos alegados podem ser considerados verdadeiros e o tribunal pode decidir contra si.',
  },
  cobranca: {
    resumo: 'É um pedido de pagamento de um valor que consideram em dívida.',
    pedido: 'Pedem que pague ou regularize o valor indicado.',
    consequencias:
      'Se não pagar nem contestar, podem cobrar juros, suspender o serviço ou avançar para cobrança judicial.',
  },
  liquidacao_imposto: {
    resumo: 'É uma nota das Finanças com o imposto calculado e o valor a pagar ou a receber.',
    pedido: 'Se houver valor a pagar, deve pagá-lo até à data limite indicada na carta.',
    consequencias:
      'Se não pagar a tempo, há juros e pode ser instaurada uma execução fiscal. Se não concordar, pode reclamar.',
  },
  informacao: {
    resumo: 'É uma carta informativa.',
    pedido: 'Não parece pedir nenhuma ação.',
    consequencias: 'Guarde a carta.',
  },
  outro: {
    resumo:
      'Sem IA, a app só reconhece alguns tipos de carta. Leia o texto com atenção ou ative uma IA nas definições.',
    pedido: 'Veja na carta o que é pedido e até quando.',
    consequencias: 'Se tiver dúvidas, peça ajuda à entidade que enviou a carta ou a um jurista.',
  },
};

export function extractWithKeywords(text: string): Extraction {
  const { emissor, nome } = issuerOf(text);
  const tipo = typeOf(text, emissor);
  const seen = new Set<string>();
  const datas = findDates(text)
    .filter((d) => (seen.has(d.data) ? false : (seen.add(d.data), true)))
    .slice(0, 12)
    .map((d, i) => ({ data: d.data, descricao: meaningOf(text, d.inicio, i) }));
  const firstLine =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^(assunto|ref\.?\s*:|referente)/i.test(fold(l))) ?? '';
  return {
    emissor,
    emissor_nome: nome,
    tipo,
    assunto: firstLine.replace(/^assunto\s*:?\s*/i, '').slice(0, 300),
    ...SUMMARIES[tipo],
    datas,
  };
}
