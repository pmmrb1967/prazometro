import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHUNK_MAX } from './backup';
import { toB64url } from './lib';
import { MAX_SHARES } from './shares';
import { Client, registerAccount, testDb } from './testing';

let DB: D1Database;
let dispose: () => Promise<void>;
beforeEach(async () => ({ DB, dispose } = await testDb()));
afterEach(() => dispose());

const newId = () => toB64url(crypto.getRandomValues(new Uint8Array(16)));
const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);

describe('partilha familiar', () => {
  it('o dono cria e atualiza; quem tem a ligação lê sem conta; retirar corta o acesso', async () => {
    const { client } = await registerAccount(DB);
    const id = newId();
    const put = await client.call(`/shares/${id}?ambito=garantia`, {
      method: 'PUT',
      body: bytes(100),
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ version: 1 });

    const anon = new Client(DB);
    const got = await anon.call(`/shares/${id}`);
    expect(got.status).toBe(200);
    expect(got.headers.get('x-scope')).toBe('garantia');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes(100));

    // Sem alterações, o pedido condicional não devolve outra vez os dados.
    expect((await anon.call(`/shares/${id}`, { headers: { 'if-none-match': '"1"' } })).status).toBe(
      304,
    );

    const upd = await client.call(`/shares/${id}?ambito=garantia`, {
      method: 'PUT',
      body: bytes(50, 9),
    });
    expect(await upd.json()).toEqual({ version: 2 });
    const got2 = await anon.call(`/shares/${id}`, { headers: { 'if-none-match': '"1"' } });
    expect(got2.headers.get('x-version')).toBe('2');

    const list = await client.json<{ partilhas: { id: string; scope: string }[] }>('/shares');
    expect(list.data.partilhas.map((p) => p.id)).toEqual([id]);

    expect((await client.call(`/shares/${id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await anon.call(`/shares/${id}`)).status).toBe(404);
  });

  it('só o dono altera ou retira; e não muda de âmbito', async () => {
    const a = await registerAccount(DB);
    const b = await registerAccount(DB);
    const id = newId();
    await a.client.call(`/shares/${id}?ambito=sns`, { method: 'PUT', body: bytes(10) });
    expect(
      (await b.client.call(`/shares/${id}?ambito=sns`, { method: 'PUT', body: bytes(10) })).status,
    ).toBe(404);
    expect((await b.client.call(`/shares/${id}`, { method: 'DELETE' })).status).toBe(404);
    expect(
      (await a.client.call(`/shares/${id}?ambito=cartas`, { method: 'PUT', body: bytes(10) }))
        .status,
    ).toBe(404);
    expect(
      (await new Client(DB).call(`/shares/${id}?ambito=sns`, { method: 'PUT', body: bytes(10) }))
        .status,
    ).toBe(401);
  });

  it('recusa âmbitos desconhecidos, ids inválidos, dados a mais e mais de 10 partilhas', async () => {
    const { client } = await registerAccount(DB);
    expect(
      (await client.call(`/shares/${newId()}?ambito=tudo`, { method: 'PUT', body: bytes(10) }))
        .status,
    ).toBe(400);
    expect(
      (await client.call('/shares/curto?ambito=sns', { method: 'PUT', body: bytes(10) })).status,
    ).toBe(404);
    expect(
      (
        await client.call(`/shares/${newId()}?ambito=sns`, {
          method: 'PUT',
          body: bytes(CHUNK_MAX + 1),
        })
      ).status,
    ).toBe(413);
    for (let i = 0; i < MAX_SHARES; i++) {
      await client.call(`/shares/${newId()}?ambito=sns`, { method: 'PUT', body: bytes(10) });
    }
    expect(
      (await client.call(`/shares/${newId()}?ambito=sns`, { method: 'PUT', body: bytes(10) }))
        .status,
    ).toBe(409);
  });

  it('em modo poupança não se criam nem atualizam partilhas, mas continuam a ler-se', async () => {
    const { client } = await registerAccount(DB);
    const id = newId();
    await client.call(`/shares/${id}?ambito=sns`, { method: 'PUT', body: bytes(10) });
    await DB.prepare("INSERT INTO settings VALUES ('modo_poupanca', ?, 0)")
      .bind(
        JSON.stringify({ ate: Math.floor(Date.now() / 1000) + 3600, motivo: ['pedidos_worker'] }),
      )
      .run();
    expect(
      (await client.call(`/shares/${id}?ambito=sns`, { method: 'PUT', body: bytes(10) })).status,
    ).toBe(503);
    expect((await new Client(DB).call(`/shares/${id}`)).status).toBe(200);
  });
});
