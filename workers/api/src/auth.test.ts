import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { b64, Client, FakeAuthenticator, registerAccount, sampleWraps, testDb } from './testing';

let DB: D1Database;
let dispose: () => Promise<void>;
beforeEach(async () => ({ DB, dispose } = await testDb()));
afterEach(() => dispose());

type Opts = { challengeId: string; options: { challenge: string } };

describe('registo com passkey', () => {
  it('cria a conta, abre sessão e guarda só a chave cifrada', async () => {
    const { client } = await registerAccount(DB);
    const me = await client.json<{ passkeys: number; chaves: { kind: string }[]; copia: null }>(
      '/account',
    );
    expect(me.status).toBe(200);
    expect(me.data.passkeys).toBe(1);
    expect(me.data.chaves.map((c) => c.kind)).toEqual(['recovery']);
    expect(me.data.copia).toBeNull();
    // O servidor só tem o hash do verificador, nunca o código.
    const row = await DB.prepare('SELECT code_hash FROM recovery_codes').first<{
      code_hash: string;
    }>();
    expect(row?.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('o mesmo desafio não pode ser usado duas vezes', async () => {
    const client = new Client(DB);
    const a = await FakeAuthenticator.create();
    const opts = await client.json<Opts>('/auth/register/options', { json: {} });
    const payload = {
      challengeId: opts.data.challengeId,
      response: await a.register(opts.data.options),
      recoveryVerifier: b64(32),
      wraps: sampleWraps(),
    };
    expect((await client.call('/auth/register/verify', { json: payload })).status).toBe(200);
    expect((await client.call('/auth/register/verify', { json: payload })).status).toBe(400);
  });

  it('recusa uma resposta assinada para outro site', async () => {
    const client = new Client(DB);
    const a = await FakeAuthenticator.create();
    const opts = await client.json<Opts>('/auth/register/options', { json: {} });
    const res = await client.call('/auth/register/verify', {
      json: {
        challengeId: opts.data.challengeId,
        response: await a.register(opts.data.options, 'https://site-falso.example'),
        recoveryVerifier: b64(32),
        wraps: sampleWraps(),
      },
    });
    expect(res.status).toBe(400);
  });

  it('não aceita pedidos de anfitriões desconhecidos', async () => {
    const client = new Client(DB, 'https://outro.example');
    expect((await client.call('/auth/register/options', { json: {} })).status).toBe(400);
  });

  it('exige o cabeçalho da app nos pedidos que alteram dados', async () => {
    const client = new Client(DB);
    const res = await client.call('/auth/register/options', {
      json: {},
      headers: { 'x-prazometro': '' },
    });
    expect(res.status).toBe(403);
  });
});

describe('entrar', () => {
  it('com a passkey, depois de terminar a sessão', async () => {
    const { client, authenticator } = await registerAccount(DB);
    await client.call('/auth/logout', { json: {} });
    expect(client.cookie).toBe('');
    expect((await client.call('/account')).status).toBe(401);

    const opts = await client.json<Opts>('/auth/login/options', { json: {} });
    const res = await client.json('/auth/login/verify', {
      json: {
        challengeId: opts.data.challengeId,
        response: await authenticator.login(opts.data.options),
      },
    });
    expect(res.status).toBe(200);
    expect((await client.call('/account')).status).toBe(200);
    const pk = await DB.prepare('SELECT counter FROM passkeys').first<{ counter: number }>();
    expect(pk?.counter).toBe(1);
  });

  it('recusa uma passkey desconhecida', async () => {
    await registerAccount(DB);
    const stranger = await FakeAuthenticator.create();
    const client = new Client(DB);
    const opts = await client.json<Opts>('/auth/login/options', { json: {} });
    const res = await client.call('/auth/login/verify', {
      json: {
        challengeId: opts.data.challengeId,
        response: await stranger.login(opts.data.options),
      },
    });
    expect(res.status).toBe(401);
  });

  it('com o código de recuperação, noutro dispositivo', async () => {
    const { recoveryVerifier } = await registerAccount(DB);
    const other = new Client(DB);
    expect(
      (await other.call('/auth/recover', { json: { recoveryVerifier: b64(32) } })).status,
    ).toBe(401);
    expect((await other.call('/auth/recover', { json: { recoveryVerifier } })).status).toBe(200);
    expect((await other.call('/account')).status).toBe(200);

    // E junta uma passkey nova a essa conta.
    const a = await FakeAuthenticator.create();
    const opts = await other.json<Opts>('/auth/passkeys/options', { json: {} });
    const res = await other.call('/auth/passkeys/verify', {
      json: { challengeId: opts.data.challengeId, response: await a.register(opts.data.options) },
    });
    expect(res.status).toBe(200);
    expect((await other.json<{ passkeys: number }>('/account')).data.passkeys).toBe(2);
  });
});

describe('conta', () => {
  it('guarda a chave cifrada com a passkey, só para passkeys da própria conta', async () => {
    const { client, authenticator } = await registerAccount(DB);
    const wrap = {
      kind: 'prf',
      credential_id: authenticator.id,
      salt: b64(32),
      iv: b64(12),
      wrapped: b64(48),
    };
    expect((await client.call('/account/key-wraps', { json: wrap })).status).toBe(200);
    expect((await client.call('/account/key-wraps', { json: wrap })).status).toBe(200);
    const me = await client.json<{ chaves: { kind: string }[] }>('/account');
    expect(me.data.chaves.map((c) => c.kind).sort()).toEqual(['prf', 'recovery']);

    const other = await registerAccount(DB);
    const res = await other.client.call('/account/key-wraps', { json: wrap });
    expect(res.status).toBe(403);
  });

  it('novo código de recuperação: o antigo deixa de servir', async () => {
    const { client, recoveryVerifier } = await registerAccount(DB);
    const novo = b64(32);
    const res = await client.call('/account/recovery', {
      json: { recoveryVerifier: novo, wrap: sampleWraps()[0] },
    });
    expect(res.status).toBe(200);
    const other = new Client(DB);
    expect((await other.call('/auth/recover', { json: { recoveryVerifier } })).status).toBe(401);
    expect((await other.call('/auth/recover', { json: { recoveryVerifier: novo } })).status).toBe(
      200,
    );
  });

  it('apagar a conta remove tudo do servidor', async () => {
    const { client } = await registerAccount(DB);
    const { data } = await client.json<{ version: number }>('/backups', {
      json: { chunk_count: 1, size: 10 },
    });
    await client.call(`/backups/${data.version}/chunks/0`, {
      method: 'PUT',
      body: new Uint8Array(10),
    });
    expect((await client.call('/account', { method: 'DELETE' })).status).toBe(200);
    expect((await client.call('/account')).status).toBe(401);
    for (const t of [
      'users',
      'passkeys',
      'recovery_codes',
      'key_wraps',
      'sessions',
      'backups',
      'backup_versions',
    ]) {
      const row = await DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>();
      expect(row?.n, t).toBe(0);
    }
  });
});
