import { SYSTEM_PROMPT, userPrompt } from './prompt';
import { EXTRACTION_JSON_SCHEMA } from './schema';

// Gemini (API da Google). Usado diretamente pelo navegador com a chave da pessoa
// (gemini-own) e pelo Worker com a chave do admin (gemini-admin).

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/** O responseSchema do Gemini usa o subconjunto OpenAPI, com os tipos em maiúsculas. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === 'additionalProperties') continue;
      out[k] = k === 'type' && typeof v === 'string' ? v.toUpperCase() : toGeminiSchema(v);
    }
    return out;
  }
  return schema;
}

function modelPath(model: string) {
  if (!/^[a-z0-9.-]+$/.test(model)) throw new ProviderError('Nome de modelo inválido.');
  return `${BASE}/${model}`;
}

function friendly(status: number): string {
  if (status === 400 || status === 401 || status === 403) return 'A chave do Gemini não é válida.';
  if (status === 404) return 'O modelo do Gemini indicado não existe.';
  if (status === 429) return 'O Gemini recusou por excesso de pedidos. Tente mais tarde.';
  return 'O Gemini não respondeu. Tente mais tarde.';
}

export async function callGemini(
  text: string,
  { key, model = GEMINI_DEFAULT_MODEL }: { key: string; model?: string },
  fetchFn: typeof fetch = fetch,
): Promise<unknown> {
  const res = await fetchFn(`${modelPath(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(text) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(EXTRACTION_JSON_SCHEMA),
      },
    }),
  });
  if (!res.ok) throw new ProviderError(friendly(res.status), res.status);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const out = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  try {
    return JSON.parse(out);
  } catch {
    throw new ProviderError('O Gemini devolveu uma resposta que não é JSON.');
  }
}

/** "Testar chave": consulta o modelo, sem gastar uma chamada de geração. */
export async function testGeminiKey(
  { key, model = GEMINI_DEFAULT_MODEL }: { key: string; model?: string },
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(modelPath(model), { headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw new ProviderError(friendly(res.status), res.status);
}
