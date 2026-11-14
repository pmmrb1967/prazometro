import {
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { exportBackup, importBackup } from '../backupData';
import { markSignedIn } from './session';
import { db, SYNCED_TABLES } from '../db';
import { hasLocalChanges, type Stamped } from './merge';
import { api, ApiError } from './api';
import {
  decryptBackup,
  generateDataKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  prepareBackup,
  prfInput,
  recoveryVerifier,
  unwrapWithPrf,
  unwrapWithRecovery,
  wrapWithPrf,
  wrapWithRecovery,
  type Wrap,
} from './crypto';
import { compressPhoto } from './photos';

// Cópia na nuvem: passkeys para entrar, código de recuperação e cifra no dispositivo.

export type Account = {
  id: string;
  papel: 'user' | 'admin';
  sessao: string;
  criada_em: number;
  passkeys: number;
  chaves: (Wrap & { id: string })[];
  copia: { version: number; chunk_count: number; size: number; created_at: number } | null;
};

export { generateRecoveryCode, normalizeRecoveryCode };

/** Conta com sessão aberta, ou null. */
export async function currentAccount(): Promise<Account | null> {
  try {
    const account = await api<Account>('/account');
    markSignedIn(true);
    return account;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/** Mensagem simples para os erros das passkeys. */
export function passkeyErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const name =
    e instanceof WebAuthnError ? (e.cause as Error | undefined)?.name : (e as Error)?.name;
  if (
    name === 'NotAllowedError' ||
    (e instanceof WebAuthnError && e.code === 'ERROR_CEREMONY_ABORTED')
  )
    return 'O pedido foi cancelado ou o tempo acabou. Tente outra vez.';
  if (name === 'InvalidStateError') return 'Este dispositivo já tem uma passkey desta conta.';
  return 'Não foi possível usar a passkey neste dispositivo. Pode entrar com o código de recuperação.';
}

/** Lê o resultado PRF (se o dispositivo o devolveu) e retira-o antes de enviar ao servidor. */
function takePrf(
  response: RegistrationResponseJSON | AuthenticationResponseJSON,
): Uint8Array | null {
  const ext = response.clientExtensionResults as { prf?: { results?: { first?: BufferSource } } };
  const first = ext.prf?.results?.first;
  response.clientExtensionResults = {};
  if (!first) return null;
  return first instanceof ArrayBuffer
    ? new Uint8Array(first)
    : new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
}

async function withPrf<T extends { extensions?: unknown }>(options: T): Promise<T> {
  return { ...options, extensions: { prf: { eval: { first: await prfInput() } } } };
}

async function saveKey(chave: CryptoKey) {
  const prev = await db.nuvem.get('nuvem');
  await db.nuvem.put({ ...prev, id: 'nuvem', chave });
}

/** Cria a conta: o código já foi mostrado e guardado pela pessoa. */
export async function register(code: string) {
  const dek = await generateDataKey();
  const wraps: Wrap[] = [await wrapWithRecovery(dek, code)];
  const { challengeId, options } = await api<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/auth/register/options', { json: {} });
  const response = await startRegistration({ optionsJSON: await withPrf(options) });
  const prf = takePrf(response);
  if (prf) wraps.push(await wrapWithPrf(dek, prf, response.id));
  await api('/auth/register/verify', {
    json: { challengeId, response, recoveryVerifier: await recoveryVerifier(code), wraps },
  });
  markSignedIn(true);
  await saveKey(dek);
}

export type LoginResult = { chave: boolean };

/** Entra com a passkey. Se o dispositivo suportar PRF, recupera também a chave das cópias. */
export async function loginWithPasskey(): Promise<LoginResult> {
  const { challengeId, options } = await api<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>('/auth/login/options', { json: {} });
  const response = await startAuthentication({ optionsJSON: await withPrf(options) });
  const prf = takePrf(response);
  await api('/auth/login/verify', { json: { challengeId, response } });
  markSignedIn(true);
  if (!prf) return { chave: !!(await db.nuvem.get('nuvem')) };
  sessionPrf = { credentialId: response.id, prf };
  const account = (await currentAccount())!;
  const wrap = account.chaves.find((w) => w.kind === 'prf' && w.credential_id === response.id);
  if (!wrap) return { chave: !!(await db.nuvem.get('nuvem')) };
  try {
    await saveKey(await unwrapWithPrf(wrap, prf));
    return { chave: true };
  } catch {
    return { chave: !!(await db.nuvem.get('nuvem')) };
  }
}

/** Resultado PRF da última entrada, para guardar a chave cifrada com esta passkey depois do código. */
let sessionPrf: { credentialId: string; prf: Uint8Array } | null = null;

/** Entra com o código de recuperação e recupera a chave das cópias. */
export async function loginWithCode(input: string) {
  const code = normalizeRecoveryCode(input);
  if (!code)
    throw new ApiError(400, 'O código tem 24 letras e números. Confirme se o escreveu bem.');
  await api('/auth/recover', { json: { recoveryVerifier: await recoveryVerifier(code) } });
  markSignedIn(true);
  await unlockWithCode(code);
}

/** Com a sessão aberta, recupera a chave das cópias com o código. */
export async function unlockWithCode(input: string) {
  const code = normalizeRecoveryCode(input);
  if (!code)
    throw new ApiError(400, 'O código tem 24 letras e números. Confirme se o escreveu bem.');
  const account = (await currentAccount())!;
  const wrap = account.chaves.find((w) => w.kind === 'recovery');
  if (!wrap) throw new ApiError(404, 'Esta conta não tem código de recuperação.');
  let dek: CryptoKey;
  try {
    dek = await unwrapWithRecovery(wrap, code);
  } catch {
    throw new ApiError(400, 'Código de recuperação errado.');
  }
  await saveKey(dek);
  // Se entrou com uma passkey que suporta PRF, da próxima vez já não precisa do código.
  if (sessionPrf) {
    await api('/account/key-wraps', {
      json: await wrapWithPrf(dek, sessionPrf.prf, sessionPrf.credentialId),
    });
    sessionPrf = null;
  }
}

/** Junta uma passkey deste dispositivo à conta aberta (por exemplo, depois de entrar com o código). */
export async function addPasskey() {
  const { challengeId, options } = await api<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/auth/passkeys/options', { json: {} });
  const response = await startRegistration({ optionsJSON: await withPrf(options) });
  const prf = takePrf(response);
  await api('/auth/passkeys/verify', { json: { challengeId, response } });
  const state = await db.nuvem.get('nuvem');
  if (prf && state)
    await api('/account/key-wraps', { json: await wrapWithPrf(state.chave, prf, response.id) });
}

/** Troca o código de recuperação: o antigo deixa de servir. */
export async function replaceRecoveryCode(code: string) {
  const state = await db.nuvem.get('nuvem');
  if (!state) throw new ApiError(400, 'Primeiro recupere a chave das cópias neste dispositivo.');
  await api('/account/recovery', {
    json: {
      recoveryVerifier: await recoveryVerifier(code),
      wrap: await wrapWithRecovery(state.chave, code),
    },
  });
}

export type Progress = (done: number, total: number) => void;

/** Faz a cópia: junta os dados, comprime, cifra e envia em blocos. Devolve o tamanho. */
export async function uploadBackup(incluirFotos: boolean, onProgress?: Progress) {
  return (await upload(incluirFotos, onProgress)).size;
}

async function upload(incluirFotos: boolean, onProgress?: Progress) {
  const state = await db.nuvem.get('nuvem');
  if (!state) throw new ApiError(400, 'Primeiro recupere a chave das cópias neste dispositivo.');
  const started = Date.now();
  const json = await exportBackup({ ficheiros: incluirFotos, converter: compressPhoto });
  const prepared = await prepareBackup(new TextEncoder().encode(json), state.chave);
  const { version } = await api<{ version: number }>('/backups', {
    json: { chunk_count: prepared.chunk_count, size: prepared.size },
  });
  let i = 0;
  onProgress?.(0, prepared.chunk_count);
  for await (const chunk of prepared.encrypt(version)) {
    await api(`/backups/${version}/chunks/${i}`, { method: 'PUT', body: chunk });
    onProgress?.(++i, prepared.chunk_count);
  }
  await api(`/backups/${version}/commit`, { json: {} });
  await db.nuvem.update('nuvem', {
    ultima_copia: new Date().toISOString(),
    incluir_fotos: incluirFotos,
    versao_nuvem: version,
    sincronizado_em: started,
  });
  return { size: prepared.size, version };
}

type Latest = { version: number; chunk_count: number };

/** Descarrega, decifra e junta a cópia aos dados deste dispositivo. */
export async function restoreBackup(onProgress?: Progress, known?: Latest) {
  const state = await db.nuvem.get('nuvem');
  if (!state) throw new ApiError(400, 'Primeiro recupere a chave das cópias neste dispositivo.');
  const latest = known ?? (await api<Latest>('/backups/latest'));
  const chunks: Uint8Array[] = [];
  onProgress?.(0, latest.chunk_count);
  for (let i = 0; i < latest.chunk_count; i++) {
    chunks.push(new Uint8Array(await api<ArrayBuffer>(`/backups/${latest.version}/chunks/${i}`)));
    onProgress?.(i + 1, latest.chunk_count);
  }
  let plain: Uint8Array;
  try {
    plain = await decryptBackup(chunks, state.chave, latest.version);
  } catch {
    throw new ApiError(
      400,
      'Não foi possível decifrar a cópia. Entre outra vez com o código de recuperação.',
    );
  }
  const result = await importBackup(new TextDecoder().decode(plain));
  await db.nuvem.update('nuvem', { versao_nuvem: latest.version });
  return result;
}

// ---- Sincronização -------------------------------------------------------------------------
// Junta a cópia da nuvem com este dispositivo (registo a registo, fica a alteração mais recente)
// e envia o resultado. Só descarrega quando a cópia da nuvem mudou e só envia quando há
// alterações neste dispositivo, para gastar o mínimo de pedidos e de dados.

export type SyncResult = { recebidos: number; enviado: boolean };

let syncing: Promise<SyncResult> | undefined;
const syncListeners = new Set<() => void>();

/** Avisa quem mostra o estado (a página da conta) quando uma sincronização acaba. */
export function onSynced(f: () => void) {
  syncListeners.add(f);
  return () => void syncListeners.delete(f);
}

export function synchronize(onProgress?: (fase: string, done: number, total: number) => void) {
  syncing ??= runSync(onProgress).finally(() => {
    syncing = undefined;
    syncListeners.forEach((f) => f());
  });
  return syncing;
}

async function runSync(
  onProgress?: (fase: string, done: number, total: number) => void,
): Promise<SyncResult> {
  const state = await db.nuvem.get('nuvem');
  if (!state) throw new ApiError(400, 'Primeiro recupere a chave das cópias neste dispositivo.');
  let recebidos = 0;
  const latest = await api<Latest>('/backups/latest').catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  });
  if (latest && latest.version !== state.versao_nuvem) {
    const r = await restoreBackup((d, t) => onProgress?.('A receber', d, t), latest);
    recebidos = r.alterados;
  }
  // A hora marca-se antes de juntar os dados: o que mudar durante o envio vai na próxima vez.
  const started = Date.now();
  const tables = await Promise.all(SYNCED_TABLES.map((t) => db.table<Stamped>(t).toArray()));
  const pending =
    !latest || hasLocalChanges(tables, await db.apagados.toArray(), state.sincronizado_em);
  if (pending) {
    await upload(state.incluir_fotos ?? true, (d, t) => onProgress?.('A enviar', d, t));
  }
  await db.nuvem.update('nuvem', { sincronizado_em: started });
  return { recebidos, enviado: pending };
}

let lastAuto = 0;

/**
 * Sincronização automática (com sessão aberta e a opção ligada): ao abrir a app, ao voltar a
 * ela depois de 5 minutos e ao sair (se houver alterações). Os erros (sem rede, modo poupança,
 * sessão expirada) ficam calados: tenta-se outra vez da próxima vez.
 */
export async function autoSync(reason: 'abrir' | 'voltar' | 'sair') {
  const state = await db.nuvem.get('nuvem');
  if (!state || state.sincronizar_sozinho === false) return;
  if (reason === 'voltar' && Date.now() - lastAuto < 5 * 60_000) return;
  if (reason === 'sair') {
    const tables = await Promise.all(SYNCED_TABLES.map((t) => db.table<Stamped>(t).toArray()));
    if (!hasLocalChanges(tables, await db.apagados.toArray(), state.sincronizado_em)) return;
  }
  lastAuto = Date.now();
  await synchronize().catch(() => undefined);
}

export async function logout() {
  await api('/auth/logout', { json: {} }).catch(() => undefined);
  markSignedIn(false);
  await db.nuvem.delete('nuvem');
}

export async function deleteAccount() {
  await api('/account', { method: 'DELETE' });
  markSignedIn(false);
  await db.nuvem.delete('nuvem');
}
