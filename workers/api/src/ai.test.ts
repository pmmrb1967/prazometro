import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_DAILY_LIMIT_PER_USER } from './ai';
import { Client, registerAccount, testDb } from './testing';

let DB: D1Database;
let dispose: () => Promise<void>;
beforeEach(async () => ({ DB, dispose } = await testDb()));
afterEach(async () => {
  vi.unstubAllGlobals();
  await dispose();
});

const ON = { AI_ADMIN: 'ligado', GEMINI_API_KEY: 'chave-admin', GEMINI_MODEL: 'gemini-teste' };
const LETTER =
  'Exmo. Senhor Joaquim Antunes, NIF 123456789. Fica notificado do auto de contraordenação. Prazo de 15 dias úteis.';
const RESULT = {
  emissor: 'transito',
  emissor_nome: '',
  tipo: 'contraordenacao_transito',
  assunto: '',
  resumo: '',
  pedido: '',
  consequencias: '',
  datas: [],
};

/** Gemini falso: guarda o que recebeu e devolve um resultado válido. */
function fakeGemini() {
  const sent: { url: string; key: string | null; body: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push({
        url,
        key: new Headers(init.headers).get('x-goog-api-key'),
        body: init.body as string,
      });
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(RESULT) }] } }],
      });
    }),
  );
  return sent;
}

async function account(env = ON) {
  const { client } = await registerAccount(DB);
  const c = new Client(DB, undefined, env);
  c.cookie = client.cookie;
  return c;
}

describe('IA com a chave do admin (gemini-admin)', () => {
  it('está desligada por defeito', async () => {
    const c = await account({} as typeof ON);
    expect((await c.json('/ai/status')).data).toMatchObject({ disponivel: false });
    expect((await c.call('/ai/extract', { json: { texto: LETTER } })).status).toBe(503);
  });

  it('exige conta', async () => {
    const res = await new Client(DB, undefined, ON).call('/ai/extract', {
      json: { texto: LETTER },
    });
    expect(res.status).toBe(401);
  });

  it('anonimiza outra vez no servidor e conta a chamada do dia', async () => {
    const sent = fakeGemini();
    const c = await account();
    expect((await c.json('/ai/status')).data).toMatchObject({ disponivel: true });
    const res = await c.json<{ resultado: unknown; restantes: number }>('/ai/extract', {
      json: { texto: LETTER },
    });
    expect(res.status).toBe(200);
    expect(res.data.resultado).toEqual(RESULT);
    expect(res.data.restantes).toBe(AI_DAILY_LIMIT_PER_USER - 1);
    expect(sent[0]!.url).toContain('/models/gemini-teste:generateContent');
    expect(sent[0]!.key).toBe('chave-admin');
    expect(sent[0]!.body).not.toContain('Joaquim');
    expect(sent[0]!.body).not.toContain('123456789');
    const row = await DB.prepare('SELECT provider, calls FROM ai_usage_daily').first();
    expect(row).toEqual({ provider: 'gemini-admin', calls: 1 });
  });

  it('para no limite diário por utilizador', async () => {
    fakeGemini();
    const c = await account();
    const me = await c.json<{ id: string }>('/account');
    await DB.prepare(
      "INSERT INTO ai_usage_daily (date, user_id, provider, calls) VALUES (?, ?, 'gemini-admin', ?)",
    )
      .bind(new Date().toISOString().slice(0, 10), me.data.id, AI_DAILY_LIMIT_PER_USER)
      .run();
    const res = await c.json<{ erro: string }>('/ai/extract', { json: { texto: LETTER } });
    expect(res.status).toBe(429);
    expect(res.data.erro).toMatch(/Amanhã/);
  });

  it('fica em pausa no modo poupança', async () => {
    fakeGemini();
    const c = await account();
    await DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('modo_poupanca', ?, 0)")
      .bind(
        JSON.stringify({ ate: Math.floor(Date.now() / 1000) + 3600, motivo: ['pedidos_worker'] }),
      )
      .run();
    expect((await c.json('/ai/status')).data).toMatchObject({ disponivel: false });
    expect((await c.call('/ai/extract', { json: { texto: LETTER } })).status).toBe(503);
  });

  it('se o Gemini falhar, não conta a chamada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    const c = await account();
    expect((await c.call('/ai/extract', { json: { texto: LETTER } })).status).toBe(502);
    expect(await DB.prepare('SELECT * FROM ai_usage_daily').first()).toBeNull();
  });
});
