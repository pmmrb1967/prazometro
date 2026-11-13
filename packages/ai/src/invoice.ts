import { z } from 'zod';
import { anonymize, type AnonymizeOptions } from './anonymize';
import { findDates, uniqueDates } from './dates';
import type { AiProvider } from './schema';
import type { AiTask } from './task';

// Preencher a compra a partir da fatura (módulo garantia). Como nas cartas, a leitura só
// propõe valores para a pessoa confirmar: a garantia é sempre calculada pelo motor, a partir
// da data em que recebeu o bem, que a fatura muitas vezes não tem.

export const InvoiceSchema = z.object({
  /** Nome comercial da loja ou empresa que vendeu. */
  loja: z.string().max(200),
  /** O bem comprado, em poucas palavras (o principal, se houver vários). */
  produto: z.string().max(200),
  /** Data da fatura (AAAA-MM-DD), vazia se não estiver escrita. */
  data_compra: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  /** Total pago, como está na fatura ("349,90"), vazio se não estiver escrito. */
  preco: z.string().max(20),
});
export type InvoiceReading = z.infer<typeof InvoiceSchema>;

export const INVOICE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    loja: { type: 'string' },
    produto: { type: 'string' },
    data_compra: { type: 'string', description: 'AAAA-MM-DD ou vazio' },
    preco: { type: 'string', description: 'total pago, por exemplo 349,90, ou vazio' },
  },
  required: ['loja', 'produto', 'data_compra', 'preco'],
  additionalProperties: false,
} as const;

export const INVOICE_PROMPT = `Ajudas pessoas em Portugal a registar uma compra para não perderem a garantia. Escreve em português europeu.

Recebes o texto de uma fatura ou talão, lido por OCR (pode ter erros) e já anonimizado: os dados pessoais foram trocados por marcadores como [NOME], [NIF] ou [MORADA]. Não tentes adivinhar esses dados.

A tua tarefa é só copiar da fatura:
- loja: o nome comercial da loja ou empresa que vendeu (por exemplo "Worten", não a denominação completa com "S.A."), texto vazio se não aparecer.
- produto: o bem comprado, em poucas palavras e com a marca e o modelo se aparecerem (por exemplo "Máquina de lavar roupa Bosch Serie 4"). Se houver vários, o de maior valor. Não incluas serviços como entrega ou extensão de garantia.
- data_compra: a data da fatura, no formato AAAA-MM-DD, só se estiver escrita; senão, texto vazio.
- preco: o total pago, como está escrito (por exemplo "349,90"), sem o símbolo do euro; texto vazio se não aparecer.

Regras obrigatórias:
- Não inventes nada: o que não estiver na fatura fica vazio.
- Não calcules prazos nem digas quanto tempo dura a garantia.
- Responde só com o JSON pedido.`;

/** Preencher uma compra a partir da fatura (módulo garantia). */
export const INVOICE_TASK: AiTask = {
  id: 'fatura',
  nome: 'leitura_fatura',
  system: INVOICE_PROMPT,
  user: (text) => `Texto da fatura:\n"""\n${text}\n"""`,
  schema: INVOICE_JSON_SCHEMA,
};

// ---- Montantes ---------------------------------------------------------------------------

/** "1.234,56", "1 234,56", "349,90" ou "349.90". */
const AMOUNT = /(?<![\d.,])(\d{1,3}(?:[ .]\d{3})+|\d+)[,.](\d{2})(?![\d])/g;

/** Converte um montante escrito em cêntimos (ou null se não for um montante). */
export function amountCents(written: string): number | null {
  const m = /^(\d{1,3}(?:[ .]\d{3})+|\d+)[,.](\d{2})$/.exec(written.replace(/€|EUR/gi, '').trim());
  return m ? Number(m[1]!.replace(/[ .]/g, '')) * 100 + Number(m[2]) : null;
}

/** Montantes escritos no texto, em cêntimos. */
function amountsIn(text: string): number[] {
  return [...text.matchAll(AMOUNT)].map((m) => Number(m[1]!.replace(/[ .]/g, '')) * 100 + +m[2]!);
}

/** Cêntimos no formato da app: "349,90". */
export const formatCents = (c: number) =>
  `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`;

// ---- Leitura sem IA ----------------------------------------------------------------------

/** Lojas frequentes em Portugal: chega para reconhecer o nome mesmo com o OCR imperfeito. */
const KNOWN_STORES: [RegExp, string][] = [
  [/\bworten\b/i, 'Worten'],
  [/\bfnac\b/i, 'Fnac'],
  [/media\s*markt/i, 'MediaMarkt'],
  [/r[aá]dio\s*popular/i, 'Rádio Popular'],
  [/el\s*corte\s*ingl[eé]s/i, 'El Corte Inglés'],
  [/\bikea\b/i, 'IKEA'],
  [/leroy\s*merlin/i, 'Leroy Merlin'],
  [/\bcontinente\b/i, 'Continente'],
  [/\bauchan\b/i, 'Auchan'],
  [/\bpingo\s*doce\b/i, 'Pingo Doce'],
  [/\bintermarch[eé]\b/i, 'Intermarché'],
  [/\bdecathlon\b/i, 'Decathlon'],
  [/\bamazon\b/i, 'Amazon'],
  [/\bpc\s*diga\b/i, 'PCDIGA'],
  [/\bglobal\s*data\b/i, 'Globaldata'],
  [/\bstaples\b/i, 'Staples'],
  [/\bbricomarch[eé]\b/i, 'Bricomarché'],
  [/\bconforama\b/i, 'Conforama'],
  [/\bphone\s*house\b/i, 'Phone House'],
  [/\bapple\b/i, 'Apple'],
  [/\bmeo\b/i, 'MEO'],
  [/\bvodafone\b/i, 'Vodafone'],
  [/\bnos\b/, 'NOS'],
];

/** Linhas que não são o nome da loja (títulos e menções habituais no topo das faturas). */
const NOT_STORE =
  /^(fatura|factura|fatura-recibo|fatura simplificada|recibo|talão|original|duplicado|triplicado|cópia|segunda via|página|pag\.|documento|nif|contribuinte|data|cliente|exmo|exma)\b/i;

function storeOf(text: string): string {
  for (const [re, name] of KNOWN_STORES) if (re.test(text)) return name;
  for (const raw of text.split('\n').slice(0, 8)) {
    const line = raw.trim();
    const letters = line.replace(/[^\p{L}]/gu, '');
    if (letters.length < 3 || NOT_STORE.test(line) || /\d{4}-\d{3}/.test(line)) continue;
    return line.replace(/,?\s*(S\.?\s?A\.?|Lda\.?|Unipessoal)\.?$/i, '').slice(0, 80);
  }
  return '';
}

/** Data da fatura: a da linha "Data …", se houver; senão, a primeira escrita. */
function invoiceDateOf(text: string): string {
  for (const line of text.split('\n')) {
    if (/\bdata\b/i.test(line) && !/vencimento|validade|entrega|limite/i.test(line)) {
      const d = findDates(line)[0];
      if (d) return d.data;
    }
  }
  return findDates(text)[0]?.data ?? '';
}

/** Total: o montante da linha "Total" (sem subtotais nem impostos); senão, o maior. */
function totalOf(text: string): string {
  const lines = text.split('\n');
  const scored = lines
    .map((line) => {
      if (!/total/i.test(line) || /sub-?\s?total|iva|imposto|desconto|base|ilíquido/i.test(line))
        return null;
      const amounts = amountsIn(line);
      if (!amounts.length) return null;
      const score = /a pagar|pago|geral|final|eur|€/i.test(line) ? 2 : 1;
      return { cents: amounts[amounts.length - 1]!, score };
    })
    .filter((x) => x !== null);
  if (scored.length) {
    const best = Math.max(...scored.map((s) => s.score));
    // O último total com a melhor pista: nas faturas, o total final vem no fim.
    return formatCents(scored.filter((s) => s.score === best).at(-1)!.cents);
  }
  const all = amountsIn(text);
  return all.length ? formatCents(Math.max(...all)) : '';
}

/** Leitura da fatura no dispositivo, sem IA: loja, data e total. O produto fica por escrever. */
export function invoiceWithKeywords(text: string): InvoiceReading {
  return {
    loja: storeOf(text),
    produto: '',
    data_compra: invoiceDateOf(text),
    preco: totalOf(text),
  };
}

// ---- Leitura com IA ----------------------------------------------------------------------

export type InvoiceResult = {
  resultado: InvoiceReading;
  /** Fornecedor que produziu o resultado (pode ser "none", se a IA falhou). */
  fornecedor: AiProvider;
  /** Explicação para mostrar quando se voltou ao modo sem IA. */
  aviso?: string;
};

/**
 * Lê uma fatura. Com `none` (ou sem `call`), só no dispositivo. Com IA, o texto é
 * anonimizado antes de sair, a resposta é validada com zod e só se aceitam a data e o
 * total que estão mesmo escritos na fatura. Se algo falhar, volta à leitura sem IA.
 */
export async function readInvoice(
  text: string,
  provider: AiProvider,
  call?: (anonymizedText: string, task: AiTask) => Promise<unknown>,
  options: AnonymizeOptions = {},
): Promise<InvoiceResult> {
  const local = () => invoiceWithKeywords(text);
  if (provider === 'none' || !call) return { resultado: local(), fornecedor: 'none' };

  let raw: unknown;
  try {
    raw = await call(anonymize(text, options).texto, INVOICE_TASK);
  } catch (err) {
    return {
      resultado: local(),
      fornecedor: 'none',
      aviso: `${(err as Error).message} Preenchemos sem IA.`,
    };
  }
  const parsed = InvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      resultado: local(),
      fornecedor: 'none',
      aviso: 'A resposta da IA não tinha o formato esperado. Preenchemos sem IA.',
    };
  }
  const r = parsed.data;
  const cents = amountCents(r.preco);
  return {
    resultado: {
      loja: r.loja.trim(),
      produto: r.produto.trim(),
      data_compra: uniqueDates(text).includes(r.data_compra) ? r.data_compra : '',
      preco: cents !== null && amountsIn(text).includes(cents) ? formatCents(cents) : '',
    },
    fornecedor: provider,
  };
}
