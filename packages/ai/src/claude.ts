import Anthropic from '@anthropic-ai/sdk';
import { ProviderError } from './gemini';
import { SYSTEM_PROMPT, userPrompt } from './prompt';
import { CLAUDE_DEFAULT_MODEL, EXTRACTION_JSON_SCHEMA } from './schema';

// Claude (Claude Platform), chamada diretamente do navegador com a chave da própria pessoa.
// Nunca com a chave do admin. Ponto de entrada próprio (@prazometro/ai/claude) para a app
// só descarregar o SDK quando este fornecedor é usado.

function client(key: string) {
  // dangerouslyAllowBrowser envia o cabeçalho anthropic-dangerous-direct-browser-access: true.
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

function friendly(err: unknown): ProviderError {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  )
    return new ProviderError('A chave da Claude não é válida.', err.status);
  if (err instanceof Anthropic.NotFoundError)
    return new ProviderError('O modelo da Claude indicado não existe.', 404);
  if (err instanceof Anthropic.RateLimitError)
    return new ProviderError('A Claude recusou por excesso de pedidos. Tente mais tarde.', 429);
  if (err instanceof Anthropic.APIError)
    return new ProviderError('A Claude não respondeu. Tente mais tarde.', err.status);
  return new ProviderError('Sem ligação à Claude. Tente mais tarde.');
}

export async function callClaude(
  text: string,
  { key, model = CLAUDE_DEFAULT_MODEL }: { key: string; model?: string },
): Promise<unknown> {
  let response: Anthropic.Message;
  try {
    response = await client(key).messages.create({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: EXTRACTION_JSON_SCHEMA },
      },
      messages: [{ role: 'user', content: userPrompt(text) }],
    });
  } catch (err) {
    throw friendly(err);
  }
  if (response.stop_reason === 'refusal')
    throw new ProviderError('A Claude recusou ler esta carta.');
  const out = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  try {
    return JSON.parse(out);
  } catch {
    throw new ProviderError('A Claude devolveu uma resposta que não é JSON.');
  }
}

/** "Testar chave": consulta o modelo, sem gastar uma chamada de geração. */
export async function testClaudeKey({
  key,
  model = CLAUDE_DEFAULT_MODEL,
}: {
  key: string;
  model?: string;
}): Promise<void> {
  try {
    await client(key).models.retrieve(model);
  } catch (err) {
    throw friendly(err);
  }
}
