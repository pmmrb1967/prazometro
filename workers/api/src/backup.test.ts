import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHUNK_MAX } from './backup';
import { registerAccount, testDb, type Client } from './testing';

let DB: D1Database;
let dispose: () => Promise<void>;
beforeEach(async () => ({ DB, dispose } = await testDb()));
afterEach(() => dispose());

/** Compara dados grandes pelo SHA-256 (comparar byte a byte no Vitest esgota a memória). */
async function digest(b: Uint8Array) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', b as BufferSource));
  return [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function randomChunks(size: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let off = 0; off < size; off += CHUNK_MAX) {
    const c = new Uint8Array(Math.min(CHUNK_MAX, size - off));
    for (let i = 0; i < c.length; i += 65536) crypto.getRandomValues(c.subarray(i, i + 65536));
    chunks.push(c);
  }
  return chunks;
}

async function upload(client: Client, chunks: Uint8Array[]) {
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const start = await client.json<{ version: number }>('/backups', {
    json: { chunk_count: chunks.length, size },
  });
  expect(start.status).toBe(200);
  const v = start.data.version;
  for (const [i, c] of chunks.entries()) {
    const res = await client.call(`/backups/${v}/chunks/${i}`, { method: 'PUT', body: c });
    expect(res.status).toBe(200);
  }
  return v;
}

describe('cópias de segurança', () => {
  it('envia 5 MB em blocos de 1,5 MB e devolve exatamente os mesmos bytes', async () => {
    const { client } = await registerAccount(DB);
    const chunks = randomChunks(5 * 1024 * 1024);
    expect(chunks.length).toBe(4);
    const v = await upload(client, chunks);
    expect((await client.call(`/backups/${v}/commit`, { json: {} })).status).toBe(200);

    const latest = await client.json<{ version: number; chunk_count: number; size: number }>(
      '/backups/latest',
    );
    expect(latest.data).toMatchObject({ version: v, chunk_count: 4, size: 5 * 1024 * 1024 });
    for (const [i, c] of chunks.entries()) {
      const res = await client.call(`/backups/${v}/chunks/${i}`);
      const got = new Uint8Array(await res.arrayBuffer());
      expect(got.length).toBe(c.length);
      expect(await digest(got)).toBe(await digest(c));
    }
  }, 30_000);

  it('não confirma uma cópia incompleta', async () => {
    const { client } = await registerAccount(DB);
    const { data } = await client.json<{ version: number }>('/backups', {
      json: { chunk_count: 2, size: 2000 },
    });
    await client.call(`/backups/${data.version}/chunks/0`, {
      method: 'PUT',
      body: new Uint8Array(1000),
    });
    const res = await client.call(`/backups/${data.version}/commit`, { json: {} });
    expect(res.status).toBe(409);
    expect((await client.call('/backups/latest')).status).toBe(404);
  });

  it('a nova cópia substitui a anterior', async () => {
    const { client } = await registerAccount(DB);
    const v1 = await upload(client, randomChunks(1000));
    await client.call(`/backups/${v1}/commit`, { json: {} });
    const v2 = await upload(client, randomChunks(2000));
    await client.call(`/backups/${v2}/commit`, { json: {} });
    const versions = await DB.prepare('SELECT version FROM backup_versions').all<{
      version: number;
    }>();
    expect(versions.results.map((r) => r.version)).toEqual([v2]);
    expect((await client.call(`/backups/${v1}/chunks/0`)).status).toBe(404);
  });

  it('recusa blocos acima de 1,5 MB e cópias acima de 20 MB', async () => {
    const { client } = await registerAccount(DB);
    const { data } = await client.json<{ version: number }>('/backups', {
      json: { chunk_count: 1, size: CHUNK_MAX },
    });
    const big = await client.call(`/backups/${data.version}/chunks/0`, {
      method: 'PUT',
      body: new Uint8Array(CHUNK_MAX + 1),
    });
    expect(big.status).toBe(413);
    const huge = await client.call('/backups', {
      json: { chunk_count: 14, size: 21 * 1024 * 1024 },
    });
    expect(huge.status).toBe(413);
  });

  it('ninguém lê a cópia de outra pessoa', async () => {
    const a = await registerAccount(DB);
    const v = await upload(a.client, randomChunks(100));
    await a.client.call(`/backups/${v}/commit`, { json: {} });
    const b = await registerAccount(DB);
    expect((await b.client.call(`/backups/${v}/chunks/0`)).status).toBe(404);
    expect(
      (await b.client.call(`/backups/${v}/chunks/0`, { method: 'PUT', body: new Uint8Array(5) }))
        .status,
    ).toBe(404);
  });

  it('sem sessão não há acesso', async () => {
    const { client } = await registerAccount(DB);
    client.cookie = '';
    expect((await client.call('/backups/latest')).status).toBe(401);
  });
});
