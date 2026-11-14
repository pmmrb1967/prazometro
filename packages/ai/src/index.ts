import { anonymize } from './anonymize';
import { uniqueDates } from './dates';
import { extractWithKeywords } from './keywords';
import { LETTER_TASK } from './prompt';
import type { AiTask } from './task';
import { ExtractionSchema, type AiProvider, type Extraction } from './schema';

// Camada de fornecedores de IA: interface comum extrair(texto) → JSON validado com zod.
// O fornecedor da Claude tem ponto de entrada próprio (@prazometro/ai/claude).

export * from './schema';
export * from './anonymize';
export * from './dates';
export * from './keywords';
export * from './prompt';
export * from './gemini';
export * from './task';
export * from './invoice';
export * from './deathCertificate';

/** Chama um fornecedor de IA com o texto já anonimizado e devolve o JSON por validar. */
export type ProviderCall = (anonymizedText: string, task: AiTask) => Promise<unknown>;

export type ExtractResult = {
  resultado: Extraction;
  /** Fornecedor que produziu o resultado (pode ser "none", se a IA falhou). */
  fornecedor: AiProvider;
  /** Explicação para mostrar quando se voltou ao modo sem IA. */
  aviso?: string;
};

/**
 * Lê uma carta. Com `none` (ou sem `call`), usa só palavras-chave no dispositivo.
 * Com um fornecedor de IA, o texto é anonimizado antes de sair, a resposta é validada
 * com zod e as datas que não estão escritas na carta são descartadas. Se algo falhar,
 * volta ao modo sem IA.
 */
export async function extract(
  text: string,
  provider: AiProvider,
  call?: ProviderCall,
  options: { nomes?: string[] } = {},
): Promise<ExtractResult> {
  const local = () => extractWithKeywords(text);
  if (provider === 'none' || !call) return { resultado: local(), fornecedor: 'none' };

  let raw: unknown;
  try {
    raw = await call(anonymize(text, options).texto, LETTER_TASK);
  } catch (err) {
    return {
      resultado: local(),
      fornecedor: 'none',
      aviso: `${(err as Error).message} Mostramos a leitura sem IA.`,
    };
  }
  const parsed = ExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      resultado: local(),
      fornecedor: 'none',
      aviso: 'A resposta da IA não tinha o formato esperado. Mostramos a leitura sem IA.',
    };
  }
  const written = new Set(uniqueDates(text));
  const resultado = {
    ...parsed.data,
    datas: parsed.data.datas.filter((d) => written.has(d.data)),
  };
  return { resultado, fornecedor: provider };
}
