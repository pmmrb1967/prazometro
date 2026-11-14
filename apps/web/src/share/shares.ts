import { api, ApiError } from '../cloud/api';
import { db, type ReceivedShare, type SentShare, type ShareData, type ShareScope } from '../db';
import { decryptShare, encryptShare, newShare, type Scope } from './shareCrypto';

// Partilhas: criar, atualizar ao abrir a app, receber e retirar. Sem tempo real: quem partilha
// envia os dados quando abre a app e houve mudanças; quem recebe vai buscá-los quando abre a app.

export const SCOPE_LABELS: Record<ShareScope, string> = {
  garantia: 'Garantias das compras',
  sns: 'Espera no SNS',
  cartas: 'Cartas',
  'pos-obito': 'Após um falecimento',
};

const FORMAT = 'prazometro-partilha';

type Payload = { formato: typeof FORMAT; versao: 1; ambito: ShareScope; de?: string } & ShareData;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Dados locais de um tema, sem fotografias nem ficheiros. */
export async function scopeData(scope: ShareScope): Promise<ShareData> {
  switch (scope) {
    case 'garantia':
      return { compras: (await db.compras.toArray()).map(({ fatura_id: _, ...p }) => p) };
    case 'sns':
      return { pedidos_sns: await db.pedidos_sns.toArray() };
    case 'cartas':
      return { cartas: await db.cartas.toArray() };
    case 'pos-obito':
      return { processos_obito: await db.processos_obito.toArray() };
  }
}

async function sha256(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Envia os dados atuais se mudaram desde a última vez (ou sempre, com `force`). */
export async function pushShare(s: SentShare, force = false): Promise<boolean> {
  const data = await scopeData(s.ambito);
  const payload: Payload = { formato: FORMAT, versao: 1, ambito: s.ambito, de: s.de, ...data };
  const json = JSON.stringify(payload);
  const hash = await sha256(json);
  if (!force && hash === s.hash) return false;
  const body = await encryptShare(enc.encode(json), s.chave, s.id, s.ambito as Scope);
  const { version } = await api<{ version: number }>(
    `/shares/${s.id}?ambito=${encodeURIComponent(s.ambito)}`,
    { method: 'PUT', body: body as BodyInit },
  );
  await db.partilhas_enviadas.update(s.id, {
    hash,
    versao: version,
    enviada_em: new Date().toISOString(),
  });
  return true;
}

export async function createShare(scope: ShareScope, de?: string, para?: string) {
  const { id, chave } = newShare();
  const share: SentShare = {
    id,
    ambito: scope,
    chave,
    de,
    para,
    criado_em: new Date().toISOString(),
  };
  await db.partilhas_enviadas.add(share);
  try {
    await pushShare(share, true);
  } catch (e) {
    await db.partilhas_enviadas.delete(id);
    throw e;
  }
  return share;
}

/** Retira o acesso no servidor e esquece a partilha neste dispositivo. */
export async function revokeShare(id: string) {
  try {
    await api(`/shares/${id}`, { method: 'DELETE' });
  } catch (e) {
    // Já não existia no servidor: basta esquecê-la aqui.
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  await db.partilhas_enviadas.delete(id);
}

type Fetched =
  | { estado: 'igual' }
  | { estado: 'retirada' }
  | { estado: 'nova'; ambito: ShareScope; versao: number; dados: ShareData; de?: string };

/** Vai buscar uma partilha pelo id; decifra-a com a chave da ligação. */
export async function fetchShare(id: string, chave: string, versao?: number): Promise<Fetched> {
  let res: Response;
  try {
    res = await fetch(`/api/shares/${id}`, {
      headers: versao ? { 'if-none-match': `"${versao}"` } : {},
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Sem ligação à internet. Tente outra vez quando tiver rede.');
  }
  if (res.status === 304) return { estado: 'igual' };
  if (res.status === 404) return { estado: 'retirada' };
  if (!res.ok)
    throw new ApiError(res.status, 'Não foi possível abrir a partilha. Tente mais tarde.');
  const ambito = res.headers.get('x-scope') as ShareScope;
  const plain = await decryptShare(
    new Uint8Array(await res.arrayBuffer()),
    chave,
    id,
    ambito as Scope,
  ).catch(() => {
    throw new ApiError(400, 'A ligação não está completa ou foi alterada. Peça uma nova ligação.');
  });
  const p = JSON.parse(dec.decode(plain)) as Payload;
  if (p.formato !== FORMAT || p.ambito !== ambito) {
    throw new ApiError(400, 'Esta partilha foi feita por uma versão diferente da app.');
  }
  const { formato: _f, versao: _v, ambito: _a, de, ...dados } = p;
  return { estado: 'nova', ambito, versao: Number(res.headers.get('x-version')), dados, de };
}

export async function refreshReceived(r: ReceivedShare): Promise<void> {
  if (r.estado === 'retirada') return;
  const f = await fetchShare(r.id, r.chave, r.versao);
  if (f.estado === 'retirada') {
    // Quem partilhou retirou o acesso: os dados deixam de ficar neste dispositivo.
    await db.partilhas_recebidas.update(r.id, { estado: 'retirada', dados: undefined });
  } else if (f.estado === 'nova') {
    await db.partilhas_recebidas.update(r.id, {
      dados: f.dados,
      de: f.de,
      versao: f.versao,
      atualizada_em: new Date().toISOString(),
    });
  }
}

let running: Promise<void> | undefined;

/**
 * Ao abrir a app: envia as partilhas que mudaram e atualiza as recebidas. Os erros (sem rede,
 * sem sessão) não interrompem nada: tenta-se outra vez da próxima vez.
 */
export function syncShares(): Promise<void> {
  running ??= (async () => {
    const [sent, received] = await Promise.all([
      db.partilhas_enviadas.toArray(),
      db.partilhas_recebidas.toArray(),
    ]);
    for (const s of sent) await pushShare(s).catch(() => undefined);
    for (const r of received) await refreshReceived(r).catch(() => undefined);
  })().finally(() => {
    running = undefined;
  });
  return running;
}
