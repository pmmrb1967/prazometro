import { anonymize, INVOICE_TASK, LETTER_TASK } from '@prazometro/ai';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  FREE_NEURONS_PER_DAY,
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
// leituras por dispositivo e por dia e, para todos, os neurons gratuitos menos uma reserva.
// O dispositivo é um identificador aleatório criado na app; guarda-se só sha256(dia + id).
// Nunca se regista o texto da carta nem o IP.

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

  let resultado: unknown;
  try {
    resultado = JSON.parse(output.choices?.[0]?.message?.content ?? '');
  } catch {
    throw new HttpError(502, 'A IA gratuita devolveu uma resposta que não se consegue ler.');
  }
  return c.json({ resultado, restantes: Math.max(0, FREE_READS_PER_DEVICE - u.mine - 1) });
});
