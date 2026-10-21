import { CHUNK_MAX, fromB64url, randomBytes, toB64url } from '../cloud/crypto';

// Partilha familiar cifrada ponta a ponta (WebCrypto).
//
// - Cada partilha tem um id (128 bits) e uma chave AES-GCM de 256 bits, ambos aleatórios.
// - A ligação de convite é /partilha#<id>.<chave>: o que vem depois do # nunca é enviado ao
//   servidor, por isso o servidor guarda só o texto cifrado e não o consegue ler.
// - O id e o tema vão nos dados adicionais do GCM: um texto cifrado não pode ser trocado por
//   outro de outra partilha sem dar erro.

export const SCOPES = ['garantia', 'sns', 'cartas', 'pos-obito'] as const;
export type Scope = (typeof SCOPES)[number];

const enc = new TextEncoder();
const ID = /^[A-Za-z0-9_-]{22}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;

export function newShare(): { id: string; chave: string } {
  return { id: toB64url(randomBytes(16)), chave: toB64url(randomBytes(32)) };
}

export function inviteLink(origin: string, id: string, chave: string): string {
  return `${origin}/partilha#${id}.${chave}`;
}

/** Lê o "#id.chave" da ligação; null se não for uma ligação de partilha válida. */
export function parseInvite(hash: string): { id: string; chave: string } | null {
  const [id, chave, ...rest] = hash.replace(/^#/, '').split('.');
  if (rest.length || !id || !chave || !ID.test(id) || !KEY.test(chave)) return null;
  return { id, chave };
}

const aad = (id: string, scope: Scope) => enc.encode(`prazometro-partilha:v1:${id}:${scope}`);

function importKey(chave: string) {
  return crypto.subtle.importKey('raw', fromB64url(chave), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export class ShareTooLargeError extends Error {}

/** Comprime e cifra; o resultado é IV (12 bytes) seguido do texto cifrado. */
export async function encryptShare(
  plain: Uint8Array,
  chave: string,
  id: string,
  scope: Scope,
): Promise<Uint8Array<ArrayBuffer>> {
  const packed = await pipe(plain, new CompressionStream('gzip'));
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad(id, scope) },
      await importKey(chave),
      packed as BufferSource,
    ),
  );
  if (12 + ct.length > CHUNK_MAX) throw new ShareTooLargeError();
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

/** Decifra; dá erro se a chave, o id ou o tema não corresponderem, ou se os dados foram alterados. */
export async function decryptShare(
  data: Uint8Array,
  chave: string,
  id: string,
  scope: Scope,
): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.subarray(0, 12) as BufferSource, additionalData: aad(id, scope) },
    await importKey(chave),
    data.subarray(12) as BufferSource,
  );
  return pipe(new Uint8Array(plain), new DecompressionStream('gzip'));
}
