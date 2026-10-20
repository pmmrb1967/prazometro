import { Hono } from 'hono';
import { z } from 'zod';
import { WrapSchema } from './auth';
import {
  fromB64url,
  HttpError,
  now,
  randomId,
  requireUser,
  sha256Hex,
  toB64url,
  type AppEnv,
} from './lib';

// A conta: o que o servidor sabe (quase nada), as chaves cifradas e o apagamento total.

export const account = new Hono<AppEnv>();
account.use('*', requireUser);

type WrapRow = {
  id: string;
  kind: 'recovery' | 'prf';
  credential_id: string | null;
  // O D1 devolve os BLOB como lista de números.
  salt: number[];
  iv: number[];
  wrapped: number[];
};

account.get('/', async (c) => {
  const userId = c.get('userId');
  const [user, passkeys, wraps, backup] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT created_at FROM users WHERE id = ?').bind(userId),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?').bind(userId),
    c.env.DB.prepare(
      'SELECT id, kind, credential_id, salt, iv, wrapped FROM key_wraps WHERE user_id = ?',
    ).bind(userId),
    c.env.DB.prepare(
      "SELECT version, chunk_count, size, created_at FROM backup_versions WHERE user_id = ? AND status = 'complete' ORDER BY version DESC LIMIT 1",
    ).bind(userId),
  ]);
  return c.json({
    criada_em: (user!.results[0] as { created_at: number }).created_at,
    passkeys: (passkeys!.results[0] as { n: number }).n,
    chaves: (wraps!.results as WrapRow[]).map((w) => ({
      id: w.id,
      kind: w.kind,
      credential_id: w.credential_id ?? undefined,
      salt: toB64url(new Uint8Array(w.salt)),
      iv: toB64url(new Uint8Array(w.iv)),
      wrapped: toB64url(new Uint8Array(w.wrapped)),
    })),
    copia: backup!.results[0] ?? null,
  });
});

/** Guarda a chave das cópias cifrada com a passkey (PRF); substitui a anterior da mesma passkey. */
account.post('/key-wraps', async (c) => {
  const parsed = WrapSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || parsed.data.kind !== 'prf' || !parsed.data.credential_id)
    throw new HttpError(400, 'Pedido inválido.');
  const w = parsed.data;
  const userId = c.get('userId');
  const owns = await c.env.DB.prepare('SELECT 1 FROM passkeys WHERE id = ? AND user_id = ?')
    .bind(w.credential_id, userId)
    .first();
  if (!owns) throw new HttpError(403, 'Pedido recusado.');
  await c.env.DB.batch([
    c.env.DB.prepare(
      "DELETE FROM key_wraps WHERE user_id = ? AND kind = 'prf' AND credential_id = ?",
    ).bind(userId, w.credential_id),
    c.env.DB.prepare(
      'INSERT INTO key_wraps (id, user_id, kind, credential_id, salt, iv, wrapped, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      randomId(),
      userId,
      'prf',
      w.credential_id,
      fromB64url(w.salt),
      fromB64url(w.iv),
      fromB64url(w.wrapped),
      now(),
    ),
  ]);
  return c.json({ ok: true });
});

/** Novo código de recuperação: o antigo deixa de servir para entrar e para decifrar. */
account.post('/recovery', async (c) => {
  const parsed = z
    .object({ recoveryVerifier: z.string().regex(/^[A-Za-z0-9_-]{43}$/), wrap: WrapSchema })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || parsed.data.wrap.kind !== 'recovery')
    throw new HttpError(400, 'Pedido inválido.');
  const { recoveryVerifier, wrap } = parsed.data;
  const userId = c.get('userId');
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM recovery_codes WHERE user_id = ?').bind(userId),
    c.env.DB.prepare("DELETE FROM key_wraps WHERE user_id = ? AND kind = 'recovery'").bind(userId),
    c.env.DB.prepare(
      'INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)',
    ).bind(randomId(), userId, await sha256Hex(recoveryVerifier), t),
    c.env.DB.prepare(
      'INSERT INTO key_wraps (id, user_id, kind, credential_id, salt, iv, wrapped, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
    ).bind(
      randomId(),
      userId,
      'recovery',
      fromB64url(wrap.salt),
      fromB64url(wrap.iv),
      fromB64url(wrap.wrapped),
      t,
    ),
  ]);
  return c.json({ ok: true });
});

/** Apagar a conta e todos os dados no servidor (RGPD, art. 17.º). */
account.delete('/', async (c) => {
  const userId = c.get('userId');
  const tables = [
    'backups',
    'backup_versions',
    'key_wraps',
    'recovery_codes',
    'passkeys',
    'sessions',
    'auth_challenges',
  ];
  await c.env.DB.batch([
    ...tables.map((t) => c.env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);
  return c.json({ ok: true });
});
