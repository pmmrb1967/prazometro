import {
  callGemini,
  CLAUDE_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  testGeminiKey,
  type AiProvider,
  type ProviderCall,
} from '@prazometro/ai';
import { todayInLisbon } from '@prazometro/engine';
import { api } from '../../cloud/api';
import { db, type AiSettings, type EncryptedSecret } from '../../db';

// Configuração da IA neste dispositivo. As chaves da pessoa ficam cifradas (AES-GCM) com uma
// chave local não exportável, guardada no IndexedDB. Nunca vão para o servidor nem para as
// cópias de segurança.

export { CLAUDE_DEFAULT_MODEL, GEMINI_DEFAULT_MODEL };

export type OwnProvider = 'gemini-own' | 'claude-own';

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  none: 'Sem IA',
  'gemini-admin': 'IA do Prazómetro (Gemini)',
  'gemini-own': 'Gemini, com a minha chave',
  'claude-own': 'Claude, com a minha chave',
};

export async function loadSettings(): Promise<AiSettings> {
  const existing = await db.ia.get('ia');
  if (existing) return existing;
  const settings: AiSettings = {
    id: 'ia',
    fornecedor: 'none',
    chave_local: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]),
    uso: {},
  };
  await db.ia.put(settings);
  return settings;
}

const field = (p: OwnProvider) => (p === 'gemini-own' ? 'chave_gemini' : 'chave_claude');

async function encrypt(key: CryptoKey, value: string): Promise<EncryptedSecret> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  );
  return { iv, dados };
}

async function decrypt(key: CryptoKey, secret: EncryptedSecret): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: secret.iv as BufferSource },
    key,
    secret.dados,
  );
  return new TextDecoder().decode(plain);
}

export async function saveKey(provider: OwnProvider, value: string) {
  const s = await loadSettings();
  await db.ia.update('ia', { [field(provider)]: await encrypt(s.chave_local, value.trim()) });
}

export async function removeKey(provider: OwnProvider) {
  await db.ia.update('ia', { [field(provider)]: undefined });
}

export async function readKey(provider: OwnProvider): Promise<string | undefined> {
  const s = await loadSettings();
  const secret = s[field(provider)];
  return secret ? decrypt(s.chave_local, secret) : undefined;
}

export const modelOf = (s: AiSettings, p: OwnProvider) =>
  p === 'gemini-own'
    ? s.modelo_gemini || GEMINI_DEFAULT_MODEL
    : s.modelo_claude || CLAUDE_DEFAULT_MODEL;

/** Verifica a chave junto do fornecedor, sem gastar uma leitura. */
export async function testKey(provider: OwnProvider, key: string, model: string) {
  if (provider === 'gemini-own') return testGeminiKey({ key, model });
  const { testClaudeKey } = await import('@prazometro/ai/claude');
  return testClaudeKey({ key, model });
}

/** Função que envia o texto (já anonimizado) ao fornecedor escolhido. */
export async function providerCall(s: AiSettings): Promise<ProviderCall | undefined> {
  if (s.fornecedor === 'gemini-admin') {
    return async (texto) =>
      (await api<{ resultado: unknown }>('/ai/extract', { json: { texto } })).resultado;
  }
  if (s.fornecedor === 'gemini-own' || s.fornecedor === 'claude-own') {
    const provider = s.fornecedor;
    const key = await readKey(provider);
    if (!key) return undefined;
    const model = modelOf(s, provider);
    if (provider === 'gemini-own') return (texto) => callGemini(texto, { key, model });
    return async (texto) => {
      const { callClaude } = await import('@prazometro/ai/claude');
      return callClaude(texto, { key, model });
    };
  }
  return undefined;
}

/** Contador local de uso (só neste dispositivo). */
export async function recordUse(provider: AiProvider) {
  const s = await loadSettings();
  const today = todayInLisbon();
  const prev = s.uso[provider];
  const hoje = prev && prev.dia === today ? prev.hoje + 1 : 1;
  await db.ia.update('ia', {
    uso: { ...s.uso, [provider]: { dia: today, hoje, total: (prev?.total ?? 0) + 1 } },
  });
}
