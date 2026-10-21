import { Hono } from 'hono';
import { z } from 'zod';
import { savingsMode } from '../../monitor/src/limits';
import { HttpError, now, requireUser, type AppEnv } from './lib';

// Cópias de segurança: o dispositivo envia blocos já cifrados (AES-GCM). O servidor só confere
// tamanhos e se chegaram todos; não consegue ler o conteúdo.

/** Cada bloco cifrado tem no máximo 1,5 MB (o D1 aceita até 2 MB por valor). */
export const CHUNK_MAX = 1_572_864;
/** Tamanho máximo da cópia de cada pessoa. */
export const BACKUP_MAX = 20 * 1024 * 1024;
/** Espaço total para cópias, abaixo dos 500 MB da base D1 gratuita. */
export const TOTAL_MAX = 400 * 1024 * 1024;

export const backups = new Hono<AppEnv>();
backups.use('*', requireUser);

const intParam = (s: string) => {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'Pedido inválido.');
  return n;
};

backups.post('/', async (c) => {
  const parsed = z
    .object({
      chunk_count: z
        .number()
        .int()
        .min(1)
        .max(Math.ceil(BACKUP_MAX / CHUNK_MAX)),
      size: z.number().int().min(1),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, 'Pedido inválido.');
  const { chunk_count, size } = parsed.data;
  if (size > BACKUP_MAX || size > chunk_count * CHUNK_MAX)
    throw new HttpError(413, 'A cópia é demasiado grande. Experimente sem as fotografias.');

  // Modo poupança (90% de um limite diário): não começam cópias novas até às 00:00 UTC.
  if (await savingsMode(c.env.DB, now())) {
    throw new HttpError(
      503,
      'As cópias na nuvem estão em pausa até à meia-noite (hora UTC), para poupar recursos. Os seus dados continuam guardados neste dispositivo. Tente amanhã.',
    );
  }

  const userId = c.get('userId');
  const db = c.env.DB;
  const [total, last] = await db.batch([
    db
      .prepare('SELECT COALESCE(SUM(size), 0) AS total FROM backup_versions WHERE user_id <> ?')
      .bind(userId),
    db
      .prepare('SELECT COALESCE(MAX(version), 0) AS v FROM backup_versions WHERE user_id = ?')
      .bind(userId),
  ]);
  if ((total!.results[0] as { total: number }).total + size > TOTAL_MAX)
    throw new HttpError(503, 'As cópias na nuvem estão temporariamente cheias. Tente mais tarde.');

  const version = (last!.results[0] as { v: number }).v + 1;
  // Uma cópia anterior que ficou a meio já não serve.
  await db.batch([
    db
      .prepare(
        "DELETE FROM backups WHERE user_id = ? AND version IN (SELECT version FROM backup_versions WHERE user_id = ? AND status = 'uploading')",
      )
      .bind(userId, userId),
    db
      .prepare("DELETE FROM backup_versions WHERE user_id = ? AND status = 'uploading'")
      .bind(userId),
    db
      .prepare(
        "INSERT INTO backup_versions (user_id, version, chunk_count, size, status, created_at) VALUES (?, ?, ?, ?, 'uploading', ?)",
      )
      .bind(userId, version, chunk_count, size, now()),
  ]);
  return c.json({ version });
});

backups.put('/:version/chunks/:index', async (c) => {
  const userId = c.get('userId');
  const version = intParam(c.req.param('version'));
  const index = intParam(c.req.param('index'));
  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > CHUNK_MAX) throw new HttpError(413, 'Bloco demasiado grande.');
  const v = await c.env.DB.prepare(
    "SELECT chunk_count FROM backup_versions WHERE user_id = ? AND version = ? AND status = 'uploading'",
  )
    .bind(userId, version)
    .first<{ chunk_count: number }>();
  if (!v || index >= v.chunk_count) throw new HttpError(404, 'Cópia não encontrada.');
  const data = await c.req.arrayBuffer();
  if (data.byteLength === 0 || data.byteLength > CHUNK_MAX)
    throw new HttpError(413, 'Bloco demasiado grande.');
  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO backups (user_id, version, chunk_index, data, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(userId, version, index, data, now())
    .run();
  return c.json({ ok: true });
});

/** Confirma que chegaram todos os blocos e apaga as cópias anteriores. */
backups.post('/:version/commit', async (c) => {
  const userId = c.get('userId');
  const version = intParam(c.req.param('version'));
  const db = c.env.DB;
  const [meta, got] = await db.batch([
    db
      .prepare(
        "SELECT chunk_count, size FROM backup_versions WHERE user_id = ? AND version = ? AND status = 'uploading'",
      )
      .bind(userId, version),
    db
      .prepare(
        'SELECT COUNT(*) AS n, COALESCE(SUM(length(data)), 0) AS bytes FROM backups WHERE user_id = ? AND version = ?',
      )
      .bind(userId, version),
  ]);
  const m = meta!.results[0] as { chunk_count: number; size: number } | undefined;
  if (!m) throw new HttpError(404, 'Cópia não encontrada.');
  const g = got!.results[0] as { n: number; bytes: number };
  if (g.n !== m.chunk_count || g.bytes !== m.size)
    throw new HttpError(409, 'A cópia chegou incompleta. Tente outra vez.');
  await db.batch([
    db
      .prepare("UPDATE backup_versions SET status = 'complete' WHERE user_id = ? AND version = ?")
      .bind(userId, version),
    db.prepare('DELETE FROM backups WHERE user_id = ? AND version <> ?').bind(userId, version),
    db
      .prepare('DELETE FROM backup_versions WHERE user_id = ? AND version <> ?')
      .bind(userId, version),
  ]);
  return c.json({ ok: true });
});

backups.get('/latest', async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT version, chunk_count, size, created_at FROM backup_versions WHERE user_id = ? AND status = 'complete' ORDER BY version DESC LIMIT 1",
  )
    .bind(c.get('userId'))
    .first();
  if (!row) throw new HttpError(404, 'Ainda não há nenhuma cópia.');
  return c.json(row);
});

backups.get('/:version/chunks/:index', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT b.data FROM backups b JOIN backup_versions v
       ON v.user_id = b.user_id AND v.version = b.version AND v.status = 'complete'
     WHERE b.user_id = ? AND b.version = ? AND b.chunk_index = ?`,
  )
    .bind(c.get('userId'), intParam(c.req.param('version')), intParam(c.req.param('index')))
    .first<{ data: number[] | ArrayBuffer }>();
  if (!row) throw new HttpError(404, 'Bloco não encontrado.');
  // O D1 devolve os BLOB como lista de números.
  return new Response(new Uint8Array(row.data), {
    headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' },
  });
});
