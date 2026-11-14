import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FREE_NEURONS_PER_ADDRESS,
  FREE_NEURONS_PER_DAY,
  FREE_READS_PER_DEVICE,
  NEURON_RESERVE,
  neuronsFor,
  utcDate,
} from '../../monitor/src/limits';
import { Client, testDb } from './testing';

let DB: D1Database;
let dispose: () => Promise<void>;
beforeEach(async () => ({ DB, dispose } = await testDb()));
afterEach(() => dispose());

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
const DEVICE = 'dispositivo-de-teste-123';

/** Workers AI falso: guarda o que recebeu e devolve um resultado válido. */
function fakeAi(content = JSON.stringify(RESULT)) {
  const sent: { model: string; input: { messages: { content: string }[] } }[] = [];
  const AI = {
    run: async (model: string, input: never) => {
      sent.push({ model, input });
      return {
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 3000, completion_tokens: 400 },
      };
    },
  } as unknown as Ai;
  return { AI, sent };
}

const headers = { 'x-dispositivo': DEVICE };

describe('IA gratuita (Workers AI), sem conta', () => {
  it('lê sem conta, anonimiza outra vez no servidor e conta a leitura e os neurons', async () => {
    const { AI, sent } = fakeAi();
    const c = new Client(DB, undefined, { AI });
    const res = await c.json<{ resultado: unknown; restantes: number }>('/ai/gratuita', {
      json: { texto: LETTER },
      headers,
    });
    expect(res.status).toBe(200);
    expect(res.data.resultado).toEqual(RESULT);
    expect(res.data.restantes).toBe(FREE_READS_PER_DEVICE - 1);
    const sentText = JSON.stringify(sent[0]!.input);
    expect(sentText).not.toContain('Joaquim');
    expect(sentText).not.toContain('123456789');

    const row = await DB.prepare('SELECT device, calls, neurons FROM ai_free_daily').first<{
      device: string;
      calls: number;
      neurons: number;
    }>();
    expect(row?.calls).toBe(1);
    expect(row?.neurons).toBe(neuronsFor(3000, 400));
    // Guarda só um hash que muda com o dia, nunca o identificador.
    expect(row?.device).not.toContain(DEVICE);
    expect(row?.device).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lê faturas com o prompt e o esquema da fatura, na mesma quota', async () => {
    const invoice = { loja: 'Worten', produto: 'Torradeira', data_compra: '', preco: '' };
    const { AI, sent } = fakeAi(JSON.stringify(invoice));
    const c = new Client(DB, undefined, { AI });
    const res = await c.json<{ resultado: unknown; restantes: number }>('/ai/gratuita', {
      json: {
        texto: 'WORTEN Fatura FR 1/2 Torradeira Philips 34,99 Cliente: Joaquim Antunes',
        tarefa: 'fatura',
      },
      headers,
    });
    expect(res.status).toBe(200);
    expect(res.data.resultado).toEqual(invoice);
    expect(res.data.restantes).toBe(FREE_READS_PER_DEVICE - 1);
    const input = sent[0]!.input as unknown as {
      messages: { content: string }[];
      response_format: { json_schema: { name: string } };
    };
    expect(input.response_format.json_schema.name).toBe('leitura_fatura');
    expect(input.messages[0]!.content).toMatch(/registar uma compra/);
    expect(JSON.stringify(input)).not.toContain('Joaquim');
    expect(
      (await c.call('/ai/gratuita', { json: { texto: LETTER, tarefa: 'outra' }, headers })).status,
    ).toBe(400);
  });

  it('exige o identificador do dispositivo', async () => {
    const c = new Client(DB, undefined, { AI: fakeAi().AI });
    expect((await c.call('/ai/gratuita', { json: { texto: LETTER } })).status).toBe(400);
    expect((await c.call('/ai/gratuita/status')).status).toBe(400);
  });

  it(`para depois de ${FREE_READS_PER_DEVICE} leituras no mesmo dispositivo`, async () => {
    const c = new Client(DB, undefined, { AI: fakeAi().AI });
    for (let i = 0; i < FREE_READS_PER_DEVICE; i++) {
      expect((await c.call('/ai/gratuita', { json: { texto: LETTER }, headers })).status).toBe(200);
    }
    const res = await c.json<{ erro: string }>('/ai/gratuita', {
      json: { texto: LETTER },
      headers,
    });
    expect(res.status).toBe(429);
    expect(res.data.erro).toMatch(/leituras gratuitas de hoje/);
    const status = await c.json<{ restantes: number }>('/ai/gratuita/status', { headers });
    expect(status.data.restantes).toBe(0);

    // Outro dispositivo ainda pode ler.
    const other = await c.call('/ai/gratuita', {
      json: { texto: LETTER },
      headers: { 'x-dispositivo': 'outro-dispositivo-456789' },
    });
    expect(other.status).toBe(200);
  });

  it('para para todos antes de esgotar os neurons gratuitos do dia', async () => {
    const date = utcDate(Math.floor(Date.now() / 1000));
    await DB.prepare("INSERT INTO ai_free_daily VALUES (?, 'outros', 1, ?)")
      .bind(date, FREE_NEURONS_PER_DAY - NEURON_RESERVE)
      .run();
    const c = new Client(DB, undefined, { AI: fakeAi().AI });
    const status = await c.json<{ disponivel: boolean }>('/ai/gratuita/status', { headers });
    expect(status.data.disponivel).toBe(false);
    expect((await c.call('/ai/gratuita', { json: { texto: LETTER }, headers })).status).toBe(503);
  });

  it('fica em pausa no modo poupança e sem o binding AI', async () => {
    const c = new Client(DB, undefined, { AI: fakeAi().AI });
    const ate = Math.floor(Date.now() / 1000) + 3600;
    await DB.prepare("INSERT INTO settings VALUES ('modo_poupanca', ?, 0)")
      .bind(JSON.stringify({ ate, motivo: ['pedidos_worker'] }))
      .run();
    expect((await c.call('/ai/gratuita', { json: { texto: LETTER }, headers })).status).toBe(503);

    const noAi = new Client(DB);
    expect((await noAi.call('/ai/gratuita', { json: { texto: LETTER }, headers })).status).toBe(
      503,
    );
  });

  it('se a IA devolver algo que não é JSON, responde 502 e a leitura conta', async () => {
    const c = new Client(DB, undefined, { AI: fakeAi('isto não é json').AI });
    const res = await c.call('/ai/gratuita', { json: { texto: LETTER }, headers });
    expect(res.status).toBe(502);
    const row = await DB.prepare('SELECT calls FROM ai_free_daily').first<{ calls: number }>();
    expect(row?.calls).toBe(1);
  });

  describe('por rede (endereço IP)', () => {
    const ip = { 'cf-connecting-ip': '203.0.113.7' };

    it('para um script que invente um dispositivo novo a cada pedido', async () => {
      const c = new Client(DB, undefined, { AI: fakeAi().AI });
      const first = await c.call('/ai/gratuita', {
        json: { texto: LETTER },
        headers: { ...headers, ...ip },
      });
      expect(first.status).toBe(200);
      await DB.prepare('UPDATE ai_free_address_daily SET neurons = ?')
        .bind(FREE_NEURONS_PER_ADDRESS)
        .run();
      const fresh = await c.json<{ erro: string }>('/ai/gratuita', {
        json: { texto: LETTER },
        headers: { 'x-dispositivo': 'dispositivo-inventado-0001', ...ip },
      });
      expect(fresh.status).toBe(429);
      expect(fresh.data.erro).toMatch(/a partir desta rede/);
      // Outra rede continua a poder ler.
      const other = await c.call('/ai/gratuita', {
        json: { texto: LETTER },
        headers: {
          'x-dispositivo': 'dispositivo-inventado-0002',
          'cf-connecting-ip': '203.0.113.8',
        },
      });
      expect(other.status).toBe(200);
    });

    it('guarda só um hash com o sal do dia, e apaga os dias anteriores', async () => {
      await DB.batch([
        DB.prepare("INSERT INTO settings VALUES ('ia_sal_2000-01-01', 'velho', 0)"),
        DB.prepare("INSERT INTO ai_free_address_daily VALUES ('2000-01-01', 'velho', 1, 1)"),
      ]);
      const c = new Client(DB, undefined, { AI: fakeAi().AI });
      await c.call('/ai/gratuita', { json: { texto: LETTER }, headers: { ...headers, ...ip } });
      const rows = await DB.prepare(
        'SELECT date, address, calls, neurons FROM ai_free_address_daily',
      ).all<{
        date: string;
        address: string;
        calls: number;
        neurons: number;
      }>();
      expect(rows.results).toHaveLength(1);
      const [row] = rows.results;
      expect(row!.calls).toBe(1);
      expect(row!.neurons).toBeGreaterThan(0);
      expect(row!.address).toMatch(/^[0-9a-f]{64}$/);
      expect(row!.address).not.toContain('203.0.113');
      const salts = await DB.prepare("SELECT key FROM settings WHERE key LIKE 'ia_sal_%'").all<{
        key: string;
      }>();
      expect(salts.results.map((s) => s.key)).toEqual([`ia_sal_${row!.date}`]);
    });

    it('limita as leituras por minuto', async () => {
      const AI_RATE_LIMIT = { limit: async () => ({ success: false }) } as unknown as RateLimit;
      const { AI, sent } = fakeAi();
      const c = new Client(DB, undefined, { AI, AI_RATE_LIMIT });
      const res = await c.json<{ erro: string }>('/ai/gratuita', {
        json: { texto: LETTER },
        headers: { ...headers, ...ip },
      });
      expect(res.status).toBe(429);
      expect(res.data.erro).toMatch(/Muitos pedidos/);
      expect(sent).toHaveLength(0);
    });
  });
});
