import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

export type Env = {
  DB: D1Database;
};

export type AppEnv = { Bindings: Env; Variables: { userId: string } };

// Domínios onde as passkeys podem ser usadas (o rpID é o nome do anfitrião).
export const RP_NAME = 'Prazómetro';
const RP_IDS = new Set(['app.prazometro.workers.dev', 'localhost']);
const ORIGINS = [
  'https://app.prazometro.workers.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4319',
  'http://localhost:8787',
];

export const SESSION_DAYS = 90;
export const CHALLENGE_TTL_S = 5 * 60;
const COOKIE = 'prazometro_sessao';

export const now = () => Math.floor(Date.now() / 1000);

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const randomId = () => toB64url(randomBytes(16));

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** rpID e origens aceites para o pedido; null se o anfitrião não for um dos nossos. */
export function relyingParty(c: Context) {
  const host = new URL(c.req.url).hostname;
  if (!RP_IDS.has(host)) return null;
  return { rpID: host, origins: ORIGINS.filter((o) => new URL(o).hostname === host) };
}

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 503,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Pedidos que alteram dados têm de trazer o cabeçalho x-prazometro. Um site alheio não o
 * consegue enviar sem autorização CORS (que nunca damos), o que trava pedidos forjados.
 */
export const requireAppHeader: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('x-prazometro') !== '1') {
    return c.json({ erro: 'Pedido recusado.' }, 403);
  }
  await next();
};

export async function startSession(c: Context<AppEnv>, userId: string) {
  const token = toB64url(randomBytes(32));
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, t),
    c.env.DB.prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).bind(await sha256Hex(token), userId, t, t + SESSION_DAYS * 86400),
  ]);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/api',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE);
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token))
      .run();
  }
  deleteCookie(c, COOKIE, { path: '/api', secure: true });
}

/** Exige sessão válida; põe o id do utilizador em c.get('userId'). */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ erro: 'Sessão terminada. Entre outra vez.' }, 401);
  const t = now();
  const row = await c.env.DB.prepare(
    `SELECT s.user_id, u.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256Hex(token), t)
    .first<{ user_id: string; last_seen_at: number }>();
  if (!row) return c.json({ erro: 'Sessão terminada. Entre outra vez.' }, 401);
  // Atualiza o "visto pela última vez" no máximo uma vez por dia (poupa escritas no D1).
  if (row.last_seen_at < t - 86400) {
    await c.env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .bind(t, row.user_id)
      .run();
  }
  c.set('userId', row.user_id);
  await next();
};
