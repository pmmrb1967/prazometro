import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REPORTS_PER_DAY } from './reports';
import { Client, registerAccount, testDb } from './testing';

let DB: D1Database;
let dispose: () => Promise<void>;
beforeEach(async () => ({ DB, dispose } = await testDb()));
afterEach(() => dispose());

async function makeAdmin(id: string) {
  await DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(id).run();
}

async function adminAccount() {
  const acc = await registerAccount(DB);
  const me = await acc.client.json<{ id: string }>('/account');
  await makeAdmin(me.data.id);
  return { ...acc, id: me.data.id };
}

describe('painel de admin', () => {
  it('só entra quem é admin', async () => {
    const { client } = await registerAccount(DB);
    expect((await client.call('/admin/usage')).status).toBe(403);
    expect((await new Client(DB).call('/admin/usage')).status).toBe(401);
  });

  it('o segredo ADMIN_IDS dá acesso sem mexer na D1', async () => {
    const { client } = await registerAccount(DB);
    const me = await client.json<{ id: string; papel: string }>('/account');
    expect(me.data.papel).toBe('user');

    client.env = { ADMIN_IDS: ` outro-id , ${me.data.id} ` };
    expect((await client.json<{ papel: string }>('/account')).data.papel).toBe('admin');
    expect((await client.call('/admin/usage')).status).toBe(200);

    // Uma lista que não o inclui, ou vazia, não dá acesso.
    client.env = { ADMIN_IDS: 'outro-id' };
    expect((await client.call('/admin/usage')).status).toBe(403);
    client.env = { ADMIN_IDS: '' };
    expect((await client.call('/admin/usage')).status).toBe(403);
  });

  it('exige sessão aberta com passkey, não com o código de recuperação', async () => {
    const { recoveryVerifier, client } = await adminAccount();
    expect((await client.call('/admin/usage')).status).toBe(200);
    const other = new Client(DB);
    await other.call('/auth/recover', { json: { recoveryVerifier } });
    const res = await other.json<{ erro: string }>('/admin/usage');
    expect(res.status).toBe(403);
    expect(res.data.erro).toMatch(/passkey/);
  });

  it('mostra o uso gravado pelo monitor, os alertas e o modo poupança', async () => {
    const { client } = await adminAccount();
    const today = new Date().toISOString().slice(0, 10);
    const ate = Math.floor(Date.now() / 1000) + 3600;
    await DB.batch([
      DB.prepare("INSERT INTO usage_daily VALUES (?, 'pedidos_worker', 91000, 0)").bind(today),
      DB.prepare("INSERT INTO usage_daily VALUES ('2000-01-01', 'pedidos_worker', 5, 0)"),
      DB.prepare("INSERT INTO alerts_sent VALUES (?, 'pedidos_worker', 90, 91000, 0)").bind(today),
      DB.prepare("INSERT INTO settings VALUES ('modo_poupanca', ?, 0)").bind(
        JSON.stringify({ ate, motivo: ['pedidos_worker'] }),
      ),
    ]);
    const { data } = await client.json<{
      uso: { date: string; value: number }[];
      alertas: unknown[];
      modo_poupanca: { ate: number } | null;
      metricas: Record<string, { limite?: number }>;
    }>('/admin/usage');
    expect(data.uso).toEqual([expect.objectContaining({ date: today, value: 91000 })]);
    expect(data.alertas).toHaveLength(1);
    expect(data.modo_poupanca?.ate).toBe(ate);
    expect(data.metricas.pedidos_worker?.limite).toBe(100_000);

    // Em modo poupança não começam cópias novas.
    const res = await client.call('/backups', { json: { chunk_count: 1, size: 10 } });
    expect(res.status).toBe(503);

    // O admin pode desligá-lo antes da hora.
    expect((await client.call('/admin/savings', { method: 'DELETE' })).status).toBe(200);
    expect((await client.call('/backups', { json: { chunk_count: 1, size: 10 } })).status).toBe(
      200,
    );
  });
});

describe('relatos de regras desatualizadas', () => {
  it('qualquer pessoa avisa, sem conta, e o admin muda o estado', async () => {
    const anon = new Client(DB);
    const ok = await anon.call('/reports', {
      json: { rule_id: 'sns.consulta-hospitalar-normal', message: 'A portaria mudou em 2027.' },
    });
    expect(ok.status).toBe(200);
    expect(
      (await anon.call('/reports', { json: { rule_id: 'sns.x', message: 'curto' } })).status,
    ).toBe(400);
    expect(
      (await anon.call('/reports', { json: { rule_id: '../x', message: 'mensagem comprida' } }))
        .status,
    ).toBe(400);

    const { client } = await adminAccount();
    const list = await client.json<{ relatos: { id: string; status: string }[] }>(
      '/admin/reports?estado=novo',
    );
    expect(list.data.relatos).toHaveLength(1);
    const id = list.data.relatos[0]!.id;
    expect(
      (
        await client.call(`/admin/reports/${id}`, {
          method: 'PATCH',
          json: { status: 'resolvido' },
        })
      ).status,
    ).toBe(200);
    expect(
      (await client.json<{ relatos: unknown[] }>('/admin/reports?estado=novo')).data.relatos,
    ).toHaveLength(0);
    expect(
      (await client.call(`/admin/reports/${id}`, { method: 'PATCH', json: { status: 'apagado' } }))
        .status,
    ).toBe(400);
    expect(
      (await anon.call(`/admin/reports/${id}`, { method: 'PATCH', json: { status: 'novo' } }))
        .status,
    ).toBe(401);
  });

  it(`aceita no máximo ${REPORTS_PER_DAY} por dia`, async () => {
    const t = Math.floor(Date.now() / 1000);
    await DB.batch(
      Array.from({ length: REPORTS_PER_DAY }, (_, i) =>
        DB.prepare(
          "INSERT INTO rule_reports (id, rule_id, message, created_at) VALUES (?, 'a.b', 'mensagem', ?)",
        ).bind(`r${i}`, t),
      ),
    );
    const res = await new Client(DB).call('/reports', {
      json: { rule_id: 'garantia.prazo-legal', message: 'Mais um aviso sobre a regra.' },
    });
    expect(res.status).toBe(503);
  });
});
