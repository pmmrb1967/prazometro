import { describe, expect, it } from 'vitest';
import { decryptShare, encryptShare, inviteLink, newShare, parseInvite } from './shareCrypto';

const enc = new TextEncoder();
const dec = new TextDecoder();

describe('partilha cifrada', () => {
  it('cifra e decifra com a chave da ligação', async () => {
    const { id, chave } = newShare();
    const ct = await encryptShare(enc.encode('{"compras":[1,2,3]}'), chave, id, 'garantia');
    expect(dec.decode(await decryptShare(ct, chave, id, 'garantia'))).toBe('{"compras":[1,2,3]}');
  });

  it('falha com outra chave, outro id, outro tema ou dados alterados', async () => {
    const { id, chave } = newShare();
    const other = newShare();
    const ct = await encryptShare(enc.encode('segredo'), chave, id, 'sns');
    await expect(decryptShare(ct, other.chave, id, 'sns')).rejects.toThrow();
    await expect(decryptShare(ct, chave, other.id, 'sns')).rejects.toThrow();
    await expect(decryptShare(ct, chave, id, 'cartas')).rejects.toThrow();
    const tampered = ct.slice();
    tampered[20] = tampered[20]! ^ 1;
    await expect(decryptShare(tampered, chave, id, 'sns')).rejects.toThrow();
  });

  it('a chave só aparece depois do # na ligação', () => {
    const { id, chave } = newShare();
    const link = inviteLink('https://app.prazometro.workers.dev', id, chave);
    const url = new URL(link);
    expect(url.pathname).toBe('/partilha');
    expect(url.search).toBe('');
    expect(parseInvite(url.hash)).toEqual({ id, chave });
  });

  it('recusa ligações mal copiadas', () => {
    const { id, chave } = newShare();
    expect(parseInvite(`#${id}`)).toBeNull();
    expect(parseInvite(`#${id}.${chave.slice(1)}`)).toBeNull();
    expect(parseInvite(`#${id}.${chave}.x`)).toBeNull();
    expect(parseInvite('')).toBeNull();
  });
});
