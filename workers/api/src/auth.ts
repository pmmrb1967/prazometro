import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  CHALLENGE_TTL_S,
  endSession,
  fromB64url,
  HttpError,
  now,
  randomId,
  relyingParty,
  requireUser,
  RP_NAME,
  sha256Hex,
  startSession,
  type AppEnv,
} from './lib';

// Passkeys (WebAuthn) e código de recuperação. Não há email nem palavra-passe.

const b64url = (min: number, max: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .refine((s) => {
      const n = Math.floor((s.length * 3) / 4);
      return n >= min && n <= max;
    }, 'tamanho inválido');

export const WrapSchema = z.object({
  kind: z.enum(['recovery', 'prf']),
  credential_id: b64url(16, 1024).optional(),
  salt: b64url(16, 32),
  iv: b64url(12, 12),
  wrapped: b64url(32, 64),
});
export type Wrap = z.infer<typeof WrapSchema>;

/** Verificador derivado do código de recuperação no dispositivo (32 bytes). */
const VerifierSchema = b64url(32, 32);
const CredentialResponse = z.looseObject({ id: z.string().min(1).max(1400) });

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, 'Pedido inválido.');
  return parsed.data;
}

function rp(c: Context) {
  const r = relyingParty(c);
  if (!r) throw new HttpError(400, 'Endereço não autorizado.');
  return r;
}

async function saveChallenge(
  c: Context<AppEnv>,
  challenge: string,
  kind: 'register' | 'login' | 'add',
  userId: string | null,
) {
  const id = randomId();
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM auth_challenges WHERE expires_at < ?').bind(t),
    c.env.DB.prepare(
      'INSERT INTO auth_challenges (id, challenge, kind, user_id, expires_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, challenge, kind, userId, t + CHALLENGE_TTL_S),
  ]);
  return id;
}

/** Lê e apaga o desafio (só pode ser usado uma vez). */
async function takeChallenge(c: Context<AppEnv>, id: string, kind: string) {
  const row = await c.env.DB.prepare(
    'DELETE FROM auth_challenges WHERE id = ? AND kind = ? AND expires_at > ? RETURNING challenge, user_id',
  )
    .bind(id, kind, now())
    .first<{ challenge: string; user_id: string | null }>();
  if (!row) throw new HttpError(400, 'O pedido expirou. Tente outra vez.');
  return row;
}

function wrapInserts(c: Context<AppEnv>, userId: string, wraps: Wrap[]) {
  const t = now();
  return wraps.map((w) =>
    c.env.DB.prepare(
      'INSERT INTO key_wraps (id, user_id, kind, credential_id, salt, iv, wrapped, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      randomId(),
      userId,
      w.kind,
      w.credential_id ?? null,
      fromB64url(w.salt),
      fromB64url(w.iv),
      fromB64url(w.wrapped),
      t,
    ),
  );
}

const registrationOptions = (rpID: string, userId: string, exclude: string[] = []) =>
  generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new Uint8Array(new TextEncoder().encode(userId)),
    userName: 'Prazómetro',
    userDisplayName: 'Cópia de segurança do Prazómetro',
    attestationType: 'none',
    excludeCredentials: exclude.map((id) => ({ id })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });

async function verifyRegistration(c: Context, response: unknown, challenge: string) {
  const { rpID, origins } = rp(c);
  const v = await verifyRegistrationResponse({
    response: response as RegistrationResponseJSON,
    expectedChallenge: challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserVerification: false,
  }).catch(() => null);
  if (!v?.verified) throw new HttpError(400, 'Não foi possível confirmar a passkey.');
  return v.registrationInfo.credential;
}

export const auth = new Hono<AppEnv>();

auth.post('/register/options', async (c) => {
  const userId = randomId();
  const options = await registrationOptions(rp(c).rpID, userId);
  const challengeId = await saveChallenge(c, options.challenge, 'register', userId);
  return c.json({ challengeId, options });
});

auth.post('/register/verify', async (c) => {
  const b = await body(
    c,
    z.object({
      challengeId: z.string(),
      response: CredentialResponse,
      recoveryVerifier: VerifierSchema,
      wraps: z.array(WrapSchema).min(1).max(2),
    }),
  );
  if (!b.wraps.some((w) => w.kind === 'recovery')) throw new HttpError(400, 'Pedido inválido.');
  const ch = await takeChallenge(c, b.challengeId, 'register');
  const cred = await verifyRegistration(c, b.response, ch.challenge);
  const userId = ch.user_id!;
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO users (id, role, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
    ).bind(userId, 'user', t, t),
    c.env.DB.prepare(
      'INSERT INTO passkeys (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(cred.id, userId, cred.publicKey, cred.counter, JSON.stringify(cred.transports ?? []), t),
    c.env.DB.prepare(
      'INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)',
    ).bind(randomId(), userId, await sha256Hex(b.recoveryVerifier), t),
    ...wrapInserts(c, userId, b.wraps),
  ]);
  await startSession(c, userId, 'passkey');
  return c.json({ ok: true, credentialId: cred.id });
});

auth.post('/login/options', async (c) => {
  const options = await generateAuthenticationOptions({
    rpID: rp(c).rpID,
    userVerification: 'preferred',
  });
  const challengeId = await saveChallenge(c, options.challenge, 'login', null);
  return c.json({ challengeId, options });
});

auth.post('/login/verify', async (c) => {
  const b = await body(c, z.object({ challengeId: z.string(), response: CredentialResponse }));
  const ch = await takeChallenge(c, b.challengeId, 'login');
  const pk = await c.env.DB.prepare(
    'SELECT id, user_id, public_key, counter, transports FROM passkeys WHERE id = ?',
  )
    .bind(b.response.id)
    .first<{
      id: string;
      user_id: string;
      public_key: number[];
      counter: number;
      transports: string;
    }>();
  if (!pk) throw new HttpError(401, 'Esta passkey não está associada a nenhuma conta.');
  const { rpID, origins } = rp(c);
  const v = await verifyAuthenticationResponse({
    response: b.response as unknown as AuthenticationResponseJSON,
    expectedChallenge: ch.challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    credential: {
      id: pk.id,
      publicKey: new Uint8Array(pk.public_key),
      counter: pk.counter,
      transports: JSON.parse(pk.transports || '[]'),
    },
    requireUserVerification: false,
  }).catch(() => null);
  if (!v?.verified) throw new HttpError(401, 'Não foi possível confirmar a passkey.');
  await c.env.DB.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?')
    .bind(v.authenticationInfo.newCounter, now(), pk.id)
    .run();
  await startSession(c, pk.user_id, 'passkey');
  return c.json({ ok: true, credentialId: pk.id });
});

/** Entrar com o código de recuperação (por exemplo, num telemóvel sem a passkey). */
auth.post('/recover', async (c) => {
  const b = await body(c, z.object({ recoveryVerifier: VerifierSchema }));
  const row = await c.env.DB.prepare('SELECT id, user_id FROM recovery_codes WHERE code_hash = ?')
    .bind(await sha256Hex(b.recoveryVerifier))
    .first<{ id: string; user_id: string }>();
  if (!row) throw new HttpError(401, 'Código de recuperação errado.');
  await c.env.DB.prepare('UPDATE recovery_codes SET used_at = ? WHERE id = ?')
    .bind(now(), row.id)
    .run();
  await startSession(c, row.user_id, 'recovery');
  return c.json({ ok: true });
});

/** Juntar uma passkey deste dispositivo a uma conta já aberta. */
auth.post('/passkeys/options', requireUser, async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare('SELECT id FROM passkeys WHERE user_id = ?')
    .bind(userId)
    .all<{ id: string }>();
  const options = await registrationOptions(
    rp(c).rpID,
    userId,
    results.map((r) => r.id),
  );
  const challengeId = await saveChallenge(c, options.challenge, 'add', userId);
  return c.json({ challengeId, options });
});

auth.post('/passkeys/verify', requireUser, async (c) => {
  const b = await body(c, z.object({ challengeId: z.string(), response: CredentialResponse }));
  const ch = await takeChallenge(c, b.challengeId, 'add');
  if (ch.user_id !== c.get('userId')) throw new HttpError(403, 'Pedido recusado.');
  const cred = await verifyRegistration(c, b.response, ch.challenge);
  await c.env.DB.prepare(
    'INSERT INTO passkeys (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      cred.id,
      ch.user_id,
      cred.publicKey,
      cred.counter,
      JSON.stringify(cred.transports ?? []),
      now(),
    )
    .run();
  return c.json({ ok: true, credentialId: cred.id });
});

auth.post('/logout', async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});
