import { describe, expect, it } from 'vitest';
import {
  CHUNK_MAX,
  decryptBackup,
  generateDataKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  prepareBackup,
  recoveryVerifier,
  unwrapWithPrf,
  unwrapWithRecovery,
  wrapWithPrf,
  wrapWithRecovery,
} from './crypto';

/** Dados parecidos com uma cópia real: JSON com fotografias em base64 (comprimem pouco). */
function fakeBackup(size: number): Uint8Array {
  const random = new Uint8Array(Math.floor(size * 0.75));
  for (let i = 0; i < random.length; i += 65536)
    crypto.getRandomValues(random.subarray(i, i + 65536));
  let b64 = '';
  for (let i = 0; i < random.length; i += 0x8000) {
    b64 += btoa(String.fromCharCode(...random.subarray(i, i + 0x8000)));
  }
  return new TextEncoder().encode(JSON.stringify({ formato: 'prazometro-copia', foto: b64 }));
}

/** Compara dados grandes pelo SHA-256 (comparar byte a byte no Vitest esgota a memória). */
async function digest(b: Uint8Array) {
  return toHex(await crypto.subtle.digest('SHA-256', b as BufferSource));
}
const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function roundTrip(plain: Uint8Array, version = 7) {
  const dek = await generateDataKey();
  const prepared = await prepareBackup(plain, dek);
  const chunks: Uint8Array[] = [];
  for await (const c of prepared.encrypt(version)) chunks.push(c);
  return { dek, prepared, chunks, out: await decryptBackup(chunks, dek, version) };
}

describe('código de recuperação', () => {
  it('tem 24 caracteres sem letras confundíveis, em grupos de 4', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(generateRecoveryCode()).not.toBe(code);
  });

  it('aceita o código escrito à mão, com minúsculas, espaços e O em vez de 0', () => {
    expect(normalizeRecoveryCode('7k2m 0abc-defg hjkm npqr stvw')).toBe(
      '7K2M-0ABC-DEFG-HJKM-NPQR-STVW',
    );
    expect(normalizeRecoveryCode('7K2M-OABC-DEFG-HJKM-NPQR-STVW')).toBe(
      '7K2M-0ABC-DEFG-HJKM-NPQR-STVW',
    );
    expect(normalizeRecoveryCode('curto')).toBeNull();
    expect(normalizeRecoveryCode('7K2M-0ABC-DEFG-HJKM-NPQR-STVU')).toBeNull();
  });

  it('o verificador é sempre o mesmo para o mesmo código, e diferente do código', async () => {
    const code = generateRecoveryCode();
    const v = await recoveryVerifier(code);
    expect(v).toHaveLength(43);
    expect(await recoveryVerifier(code)).toBe(v);
    expect(await recoveryVerifier(generateRecoveryCode())).not.toBe(v);
  });
});

describe('chave das cópias', () => {
  it('recupera-se com o código certo e não com outro', async () => {
    const dek = await generateDataKey();
    const code = generateRecoveryCode();
    const wrap = await wrapWithRecovery(dek, code);
    const back = await unwrapWithRecovery(wrap, code);
    expect(await crypto.subtle.exportKey('raw', back)).toEqual(
      await crypto.subtle.exportKey('raw', dek),
    );
    await expect(unwrapWithRecovery(wrap, generateRecoveryCode())).rejects.toThrow();
  });

  it('recupera-se com o resultado PRF da passkey', async () => {
    const dek = await generateDataKey();
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const wrap = await wrapWithPrf(dek, prf, 'cred-1');
    expect(wrap.credential_id).toBe('cred-1');
    const back = await unwrapWithPrf(wrap, prf);
    expect(await crypto.subtle.exportKey('raw', back)).toEqual(
      await crypto.subtle.exportKey('raw', dek),
    );
    await expect(unwrapWithPrf(wrap, crypto.getRandomValues(new Uint8Array(32)))).rejects.toThrow();
  });
});

describe('cifra das cópias (1 MB, 5 MB e 20 MB)', () => {
  for (const mb of [1, 5, 20]) {
    it(`${mb} MB: blocos de no máximo 1,5 MB e o mesmo conteúdo no fim`, async () => {
      const plain = fakeBackup(mb * 1024 * 1024);
      const { prepared, chunks, out } = await roundTrip(plain);
      expect(chunks).toHaveLength(prepared.chunk_count);
      expect(chunks.every((c) => c.length <= CHUNK_MAX)).toBe(true);
      expect(chunks.reduce((n, c) => n + c.length, 0)).toBe(prepared.size);
      expect(out.length).toBe(plain.length);
      expect(await digest(out)).toBe(await digest(plain));
    }, 60_000);
  }

  it('um JSON pequeno comprime bastante', async () => {
    const plain = new TextEncoder().encode(
      JSON.stringify({
        compras: Array.from({ length: 200 }, (_, i) => ({ id: i, produto: 'Máquina de lavar' })),
      }),
    );
    const { prepared, out } = await roundTrip(plain);
    expect(prepared.chunk_count).toBe(1);
    expect(prepared.size).toBeLessThan(plain.length / 5);
    expect(out).toEqual(plain);
  });

  it('dá erro com blocos trocados, com outra versão ou com a chave errada', async () => {
    const plain = fakeBackup(3 * 1024 * 1024);
    const { dek, chunks } = await roundTrip(plain, 3);
    expect(chunks.length).toBeGreaterThan(1);
    await expect(
      decryptBackup([chunks[1]!, chunks[0]!, ...chunks.slice(2)], dek, 3),
    ).rejects.toThrow();
    await expect(decryptBackup(chunks, dek, 4)).rejects.toThrow();
    await expect(decryptBackup(chunks.slice(0, -1), dek, 3)).rejects.toThrow();
    await expect(decryptBackup(chunks, await generateDataKey(), 3)).rejects.toThrow();
  }, 60_000);
});
