import { anonymize, INVOICE_TASK, LETTER_TASK } from '@prazometro/ai';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  FREE_NEURONS_PER_ADDRESS,
  FREE_NEURONS_PER_DAY,
  FREE_READS_PER_ADDRESS,
  FREE_READS_PER_DEVICE,
  NEURON_RESERVE,
  neuronsFor,
  savingsMode,
  utcDate,
  WORKERS_AI_MODEL,
} from '../../monitor/src/limits';
import { HttpError, now, sha256Hex, type AppEnv } from './lib';

// IA gratuita das cartas e das faturas (fornecedor workers-ai): Workers AI, sem chave e sem conta.
// O texto chega já anonimizado do dispositivo e volta a ser anonimizado aqui. Limites: 10
// leituras por dispositivo e por dia; por rede (endereço IP), 10 leituras por minuto e uma
// parte do dia (FREE_READS_PER_ADDRESS, FREE_NEURONS_PER_ADDRESS), para um script que invente
// identificadores não gastar a de todos; e, para todos, os neurons gratuitos menos uma reserva.
// O dispositivo é um identificador aleatório criado na app; guarda-se só sha256(dia + id).
// A rede guarda-se como sha256(sal do dia + IP), com um sal aleatório apagado no dia seguinte:
// depois disso nem com a base se volta ao IP. Nunca se regista o texto da carta nem o IP.
// Levado do Validómetro (src/worker/free-ai.ts).

const MAX_TEXT = 12_000;
const DeviceId = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

export const aiFree = new Hono<AppEnv>();

type Usage = { mine: number; neurons: number };

async function usage(db: D1Database, date: string, device: string): Promise<Usage> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN device = ? THEN calls END), 0) AS mine,
              COALESCE(SUM(neurons), 0) AS neurons
       FROM ai_free_daily WHERE date = ?`,
    )
    .bind(device, date)
    .first<Usage>();
  return row ?? { mine: 0, neurons: 0 };
}

async function deviceOf(header: string | undefined, date: string): Promise<string> {
  const parsed = DeviceId.safeParse(header);
  if (!parsed.success) throw new HttpError(400, 'Falta o identificador do dispositivo.');
  return sha256Hex(`${date}:${parsed.data}`);
}

/**
 * O sal do dia, criado no primeiro pedido do dia. Nesse momento apagam-se os sais e as redes
 * dos dias anteriores (o monitor não precisa de saber destas linhas).
 */
async function daySalt(db: D1Database, date: string): Promise<string> {
  const key = `ia_sal_${date}`;
  const fresh = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const created = await db
    .prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO NOTHING',
    )
    .bind(key, fresh, now())
    .run();
  if (created.meta.changes === 1) {
    await db.batch([
      db.prepare("DELETE FROM settings WHERE key LIKE 'ia_sal_%' AND key < ?").bind(key),
      db.prepare('DELETE FROM ai_free_address_daily WHERE date < ?').bind(date),
    ]);
    return fresh;
  }
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? fresh;
}

/** A rede deste pedido, como hash com o sal do dia; null sem cabeçalho (testes, dev). */
async function addressOf(c: Context<AppEnv>, date: string): Promise<string | null> {
  const ip = c.req.header('cf-connecting-ip');
  if (!ip) return null;
  return sha256Hex(`${await daySalt(c.env.DB, date)}:${ip}`);
}

/** Mais de 10 leituras no último minuto a partir deste IP (contado em memória). */
async function tooFast(c: Context<AppEnv>): Promise<boolean> {
  const ip = c.req.header('cf-connecting-ip');
  if (!ip || !c.env.AI_RATE_LIMIT) return false;
  const { success } = await c.env.AI_RATE_LIMIT.limit({ key: ip });
  return !success;
}

/**
 * Tira uma leitura da parte desta rede, se houver espaço. Numa só instrução, para leituras
 * que começam ao mesmo tempo não passarem todas.
 */
async function claimAddress(db: D1Database, date: string, address: string): Promise<boolean> {
  const row = await db
    .prepare(
      `INSERT INTO ai_free_address_daily (date, address, calls, neurons) VALUES (?, ?, 1, 0)
       ON CONFLICT (date, address) DO UPDATE SET calls = calls + 1
         WHERE calls < ? AND neurons < ?
       RETURNING calls`,
    )
    .bind(date, address, FREE_READS_PER_ADDRESS, FREE_NEURONS_PER_ADDRESS)
    .first<{ calls: number }>();
  return row !== null;
}

const quotaLeft = (u: Usage) => u.neurons < FREE_NEURONS_PER_DAY - NEURON_RESERVE;

aiFree.get('/status', async (c) => {
  const t = now();
  const date = utcDate(t);
  const device = await deviceOf(c.req.header('x-dispositivo'), date);
  const [u, poupanca] = await Promise.all([
    usage(c.env.DB, date, device),
    savingsMode(c.env.DB, t),
  ]);
  return c.json({
    disponivel: !!c.env.AI && !poupanca && quotaLeft(u),
    restantes: Math.max(0, FREE_READS_PER_DEVICE - u.mine),
    limite_diario: FREE_READS_PER_DEVICE,
  });
});

type ChatOutput = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

aiFree.post('/', async (c) => {
  if (!c.env.AI) throw new HttpError(503, 'A IA gratuita não está disponível.');
  const t = now();
  const date = utcDate(t);
  const device = await deviceOf(c.req.header('x-dispositivo'), date);
  if (await savingsMode(c.env.DB, t)) {
    throw new HttpError(
      503,
      'A IA gratuita está em pausa até amanhã, para não passar os limites gratuitos.',
    );
  }
  const parsed = z
    .object({
      texto: z.string().trim().min(20).max(MAX_TEXT),
      tarefa: z.enum(['carta', 'fatura']).default('carta'),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, 'Texto em falta ou demasiado longo.');
  const task = parsed.data.tarefa === 'fatura' ? INVOICE_TASK : LETTER_TASK;

  const u = await usage(c.env.DB, date, device);
  if (u.mine >= FREE_READS_PER_DEVICE) {
    throw new HttpError(
      429,
      `Já usou as ${FREE_READS_PER_DEVICE} leituras gratuitas de hoje. Amanhã pode voltar a usar, ou use a sua chave.`,
    );
  }
  if (!quotaLeft(u)) {
    throw new HttpError(
      503,
      'Hoje já se esgotaram as leituras gratuitas para todos. Tente amanhã, ou use a sua chave.',
    );
  }
  if (await tooFast(c)) {
    throw new HttpError(429, 'Muitos pedidos seguidos. Tente daqui a um minuto.');
  }
  const address = await addressOf(c, date);
  if (address && !(await claimAddress(c.env.DB, date, address))) {
    throw new HttpError(
      429,
      'Hoje já se fizeram muitas leituras gratuitas a partir desta rede. Amanhã pode voltar a usar, ou use a sua chave.',
    );
  }

  let output: ChatOutput;
  try {
    output = (await c.env.AI.run(
      WORKERS_AI_MODEL as Parameters<Ai['run']>[0],
      {
        messages: [
          { role: 'system', content: task.system },
          { role: 'user', content: task.user(anonymize(parsed.data.texto).texto) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: task.nome, schema: task.schema, strict: true },
        },
        max_completion_tokens: 1500,
        temperature: 0,
        chat_template_kwargs: { enable_thinking: false },
      } as never,
    )) as ChatOutput;
  } catch (err) {
    // Só o tipo de erro: nunca o texto da carta.
    const message = err instanceof Error ? err.message : '';
    console.error('workers-ai falhou', /4006|neurons|allocation/i.test(message) ? 'quota' : 'erro');
    throw new HttpError(502, 'A IA gratuita não respondeu. Tente mais tarde.');
  }

  const neurons = neuronsFor(
    output.usage?.prompt_tokens ?? 0,
    output.usage?.completion_tokens ?? 0,
  );
  await c.env.DB.prepare(
    `INSERT INTO ai_free_daily (date, device, calls, neurons) VALUES (?, ?, 1, ?)
     ON CONFLICT (date, device) DO UPDATE SET calls = calls + 1, neurons = neurons + excluded.neurons`,
  )
    .bind(date, device, neurons)
    .run();
  if (address) {
    await c.env.DB.prepare(
      'UPDATE ai_free_address_daily SET neurons = neurons + ? WHERE date = ? AND address = ?',
    )
      .bind(neurons, date, address)
      .run();
  }

  let resultado: unknown;
  try {
    resultado = JSON.parse(output.choices?.[0]?.message?.content ?? '');
  } catch {
    throw new HttpError(502, 'A IA gratuita devolveu uma resposta que não se consegue ler.');
  }
  return c.json({ resultado, restantes: Math.max(0, FREE_READS_PER_DEVICE - u.mine - 1) });
});
