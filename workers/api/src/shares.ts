import { Hono } from 'hono';
import { savingsMode } from '../../monitor/src/limits';
import { CHUNK_MAX } from './backup';
import { HttpError, now, requireUser, type AppEnv } from './lib';

// Partilha familiar: o dono envia os dados de um tema já cifrados no dispositivo. Quem tem a
// ligação lê o texto cifrado pelo id (sem conta) e decifra-o com a chave que vem na ligação.
// O servidor não vê a chave nem os dados. Apagar a partilha retira o acesso.

export const SCOPES = ['garantia', 'sns', 'cartas', 'pos-obito'] as const;
/** Partilhas ativas por conta (cada uma é uma linha de até 1,5 MB no D1). */
export const MAX_SHARES = 10;

const ID = /^[A-Za-z0-9_-]{22}$/;

function shareId(s: string): string {
  if (!ID.test(s)) throw new HttpError(404, 'Partilha não encontrada.');
  return s;
}

async function body(c: {
  req: { header(n: string): string | undefined; arrayBuffer(): Promise<ArrayBuffer> };
}) {
  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > CHUNK_MAX) throw new HttpError(413, 'Há demasiados dados para partilhar.');
  const data = await c.req.arrayBuffer();
  if (data.byteLength === 0) throw new HttpError(400, 'Pedido inválido.');
  if (data.byteLength > CHUNK_MAX) throw new HttpError(413, 'Há demasiados dados para partilhar.');
  return data;
}

export const shares = new Hono<AppEnv>();

/** Leitura pública pelo id: o conteúdo está cifrado e o id tem 128 bits aleatórios. */
shares.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT scope, version, data, updated_at FROM family_shares WHERE id = ?',
  )
    .bind(shareId(c.req.param('id')))
    .first<{ scope: string; version: number; data: number[] | ArrayBuffer; updated_at: number }>();
  if (!row) throw new HttpError(404, 'Esta partilha já não existe.');
  // Pedido condicional: se a versão não mudou, não se envia outra vez o conteúdo.
  if (c.req.header('if-none-match') === `"${row.version}"`) {
    return new Response(null, { status: 304, headers: { etag: `"${row.version}"` } });
  }
  return new Response(new Uint8Array(row.data), {
    headers: {
      'content-type': 'application/octet-stream',
      'cache-control': 'no-store',
      etag: `"${row.version}"`,
      'x-scope': row.scope,
      'x-version': String(row.version),
      'x-updated-at': String(row.updated_at),
    },
  });
});

const owner = new Hono<AppEnv>();
owner.use('*', requireUser);

owner.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, scope, version, size, created_at, updated_at FROM family_shares WHERE owner_id = ? ORDER BY created_at',
  )
    .bind(c.get('userId'))
    .all();
  return c.json({ partilhas: results });
});

/** Cria (se o id for novo) ou atualiza uma partilha do próprio. */
owner.put('/:id', async (c) => {
  const id = shareId(c.req.param('id'));
  const scope = c.req.query('ambito') ?? '';
  if (!(SCOPES as readonly string[]).includes(scope)) throw new HttpError(400, 'Pedido inválido.');
  if (await savingsMode(c.env.DB, now())) {
    throw new HttpError(
      503,
      'As partilhas estão em pausa até à meia-noite (hora UTC), para poupar recursos. Tente amanhã.',
    );
  }
  const data = await body(c);
  const userId = c.get('userId');
  const db = c.env.DB;
  const existing = await db
    .prepare('SELECT owner_id, scope, version FROM family_shares WHERE id = ?')
    .bind(id)
    .first<{ owner_id: string; scope: string; version: number }>();
  const t = now();
  if (existing) {
    if (existing.owner_id !== userId || existing.scope !== scope)
      throw new HttpError(404, 'Partilha não encontrada.');
    await db
      .prepare(
        'UPDATE family_shares SET version = ?, data = ?, size = ?, updated_at = ? WHERE id = ?',
      )
      .bind(existing.version + 1, data, data.byteLength, t, id)
      .run();
    return c.json({ version: existing.version + 1 });
  }
  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM family_shares WHERE owner_id = ?')
    .bind(userId)
    .first<{ n: number }>();
  if (count!.n >= MAX_SHARES)
    throw new HttpError(409, `Pode ter no máximo ${MAX_SHARES} partilhas. Retire uma antes.`);
  await db
    .prepare(
      'INSERT INTO family_shares (id, owner_id, scope, version, data, size, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)',
    )
    .bind(id, userId, scope, data, data.byteLength, t, t)
    .run();
  return c.json({ version: 1 });
});

/** Retira o acesso: quem tem a ligação deixa de conseguir abrir a partilha. */
owner.delete('/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM family_shares WHERE id = ? AND owner_id = ?')
    .bind(shareId(c.req.param('id')), c.get('userId'))
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Partilha não encontrada.');
  return c.json({ ok: true });
});

shares.route('/', owner);
