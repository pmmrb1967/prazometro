// Cifra no dispositivo (WebCrypto). O servidor só recebe dados já cifrados.
//
// - Uma chave aleatória AES-GCM de 256 bits (a "chave das cópias") cifra as cópias.
// - Essa chave é guardada no servidor embrulhada (cifrada) de duas formas:
//   1. com uma chave derivada do código de recuperação (PBKDF2-SHA-256);
//   2. com uma chave derivada do resultado PRF da passkey (HKDF), quando o dispositivo suporta.
// - Para entrar com o código, o servidor recebe só um verificador derivado dele (HKDF), que não
//   serve para decifrar nada.

const enc = new TextEncoder();

/** Alfabeto Crockford base32: sem I, L, O e U, para não haver confusões ao copiar à mão. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 24; // 24 × 5 bits = 120 bits
export const PBKDF2_ITERATIONS = 210_000;
/** Bloco cifrado no máximo 1,5 MB: 12 bytes de IV + texto + 16 bytes de etiqueta GCM. */
export const CHUNK_MAX = 1_572_864;
const PLAIN_CHUNK = CHUNK_MAX - 28;

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Novo código de recuperação, em grupos de 4: "7K2M-…". */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  const chars = [...bytes].map((b) => ALPHABET[b & 31]).join('');
  return chars.match(/.{4}/g)!.join('-');
}

/** Aceita o código como a pessoa o escrever: minúsculas, espaços, O em vez de 0, I/L em vez de 1. */
export function normalizeRecoveryCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== CODE_LENGTH || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return s.match(/.{4}/g)!.join('-');
}

async function hkdfBytes(ikm: Uint8Array, salt: Uint8Array, info: string, length = 32) {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: enc.encode(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** O que o servidor guarda (em hash) para reconhecer o código. Não serve para decifrar. */
export async function recoveryVerifier(code: string): Promise<string> {
  const bytes = await hkdfBytes(
    enc.encode(code),
    enc.encode('prazometro-verificador-v1'),
    'entrar',
  );
  return toB64url(bytes);
}

async function recoveryKek(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function prfKek(prfOutput: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const bytes = await hkdfBytes(prfOutput, salt, 'prazometro-chave-v1');
  return crypto.subtle.importKey('raw', bytes as BufferSource, 'AES-GCM', false, [
    'wrapKey',
    'unwrapKey',
  ]);
}

/** Valor fixo que se pede à passkey (extensão PRF); o resultado é diferente em cada passkey. */
export async function prfInput(): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('prazometro-prf-v1')));
}

export type Wrap = {
  kind: 'recovery' | 'prf';
  credential_id?: string;
  salt: string;
  iv: string;
  wrapped: string;
};

export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function wrapWith(dek: CryptoKey, kek: CryptoKey, salt: Uint8Array) {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv });
  return { salt: toB64url(salt), iv: toB64url(iv), wrapped: toB64url(wrapped) };
}

async function unwrapWith(w: Wrap, kek: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    fromB64url(w.wrapped),
    kek,
    { name: 'AES-GCM', iv: fromB64url(w.iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapWithRecovery(dek: CryptoKey, code: string): Promise<Wrap> {
  const salt = randomBytes(16);
  return { kind: 'recovery', ...(await wrapWith(dek, await recoveryKek(code, salt), salt)) };
}

export async function wrapWithPrf(
  dek: CryptoKey,
  prfOutput: Uint8Array,
  credentialId: string,
): Promise<Wrap> {
  const salt = randomBytes(32);
  return {
    kind: 'prf',
    credential_id: credentialId,
    ...(await wrapWith(dek, await prfKek(prfOutput, salt), salt)),
  };
}

/** Recupera a chave das cópias com o código; dá erro se o código estiver errado. */
export async function unwrapWithRecovery(w: Wrap, code: string): Promise<CryptoKey> {
  return unwrapWith(w, await recoveryKek(code, fromB64url(w.salt)));
}

export async function unwrapWithPrf(w: Wrap, prfOutput: Uint8Array): Promise<CryptoKey> {
  return unwrapWith(w, await prfKek(prfOutput, fromB64url(w.salt)));
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const aad = (version: number, index: number, count: number) =>
  enc.encode(`prazometro-copia:${version}:${index}:${count}`);

export type PreparedBackup = {
  chunk_count: number;
  size: number;
  /** Cifra os blocos depois de o servidor atribuir o número da versão. */
  encrypt: (version: number) => AsyncGenerator<Uint8Array<ArrayBuffer>>;
};

/** Comprime (gzip) e prepara a cifra em blocos de no máximo 1,5 MB. */
export async function prepareBackup(plain: Uint8Array, dek: CryptoKey): Promise<PreparedBackup> {
  const packed = await pipe(plain, new CompressionStream('gzip'));
  const count = Math.max(1, Math.ceil(packed.length / PLAIN_CHUNK));
  return {
    chunk_count: count,
    size: packed.length + 28 * count,
    async *encrypt(version: number) {
      for (let i = 0; i < count; i++) {
        const piece = packed.subarray(i * PLAIN_CHUNK, (i + 1) * PLAIN_CHUNK);
        const iv = randomBytes(12);
        const ct = new Uint8Array(
          await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: aad(version, i, count) },
            dek,
            piece as BufferSource,
          ),
        );
        const chunk = new Uint8Array(12 + ct.length);
        chunk.set(iv);
        chunk.set(ct, 12);
        yield chunk;
      }
    },
  };
}

/**
 * Decifra e descomprime. Cada bloco está ligado à versão, à posição e ao número total de blocos
 * (dados adicionais do GCM): blocos trocados, em falta ou alterados dão erro.
 */
export async function decryptBackup(
  chunks: Uint8Array[],
  dek: CryptoKey,
  version: number,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: chunk.subarray(0, 12) as BufferSource,
        additionalData: aad(version, i, chunks.length),
      },
      dek,
      chunk.subarray(12) as BufferSource,
    );
    parts.push(new Uint8Array(plain));
  }
  const packed = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    packed.set(p, off);
    off += p.length;
  }
  return pipe(packed, new DecompressionStream('gzip'));
}
