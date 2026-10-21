import { anonymize, callGemini, GEMINI_DEFAULT_MODEL, ProviderError } from '@prazometro/ai';
import { Hono } from 'hono';
import { z } from 'zod';
import { savingsMode, utcDate } from '../../monitor/src/limits';
import { HttpError, now, requireUser, type AppEnv, type Env } from './lib';

// Fornecedor gemini-admin: a carta (já anonimizada no dispositivo, e outra vez aqui) vai ao
// Gemini com a chave do admin, com limite diário por utilizador e para todos.
// Desligado por defeito: só funciona com AI_ADMIN = "ligado" e o segredo GEMINI_API_KEY.
// Nunca se regista o texto da carta.

/** Chamadas por conta e por dia (decisão em aberto no plano: valor inicial). */
export const AI_DAILY_LIMIT_PER_USER = 10;
/** Chamadas por dia para todos, abaixo da quota gratuita do Gemini. */
export const AI_DAILY_LIMIT_TOTAL = 200;
const PROVIDER = 'gemini-admin';
const MAX_TEXT = 12_000;

const enabled = (env: Env) => env.AI_ADMIN === 'ligado' && !!env.GEMINI_API_KEY;

export const ai = new Hono<AppEnv>();

ai.get('/status', async (c) => {
  const poupanca = await savingsMode(c.env.DB, now());
  return c.json({
    disponivel: enabled(c.env) && !poupanca,
    limite_diario: AI_DAILY_LIMIT_PER_USER,
  });
});

ai.post('/extract', requireUser, async (c) => {
  if (!enabled(c.env)) throw new HttpError(503, 'A IA do Prazómetro não está disponível.');
  const t = now();
  if (await savingsMode(c.env.DB, t)) {
    throw new HttpError(
      503,
      'A IA do Prazómetro está em pausa até amanhã, para não passar os limites gratuitos.',
    );
  }
  const parsed = z
    .object({ texto: z.string().trim().min(20).max(MAX_TEXT) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, 'Texto da carta em falta ou demasiado longo.');

  const userId = c.get('userId');
  const date = utcDate(t);
  const usage = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(calls), 0) AS total,
            COALESCE(SUM(CASE WHEN user_id = ? THEN calls END), 0) AS mine
     FROM ai_usage_daily WHERE date = ? AND provider = ?`,
  )
    .bind(userId, date, PROVIDER)
    .first<{ total: number; mine: number }>();
  if ((usage?.mine ?? 0) >= AI_DAILY_LIMIT_PER_USER) {
    throw new HttpError(
      429,
      `Já usou as ${AI_DAILY_LIMIT_PER_USER} leituras com IA de hoje. Amanhã pode voltar a usar.`,
    );
  }
  if ((usage?.total ?? 0) >= AI_DAILY_LIMIT_TOTAL) {
    throw new HttpError(503, 'Hoje já foram feitas muitas leituras com IA. Tente amanhã.');
  }

  let resultado: unknown;
  try {
    resultado = await callGemini(anonymize(parsed.data.texto).texto, {
      key: c.env.GEMINI_API_KEY!,
      model: c.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    });
  } catch (err) {
    console.error('gemini-admin falhou', err instanceof ProviderError ? err.status : 'rede');
    throw new HttpError(502, 'A IA não respondeu. Tente mais tarde.');
  }
  await c.env.DB.prepare(
    `INSERT INTO ai_usage_daily (date, user_id, provider, calls) VALUES (?, ?, ?, 1)
     ON CONFLICT (date, user_id, provider) DO UPDATE SET calls = calls + 1`,
  )
    .bind(date, userId, PROVIDER)
    .run();
  return c.json({ resultado, restantes: AI_DAILY_LIMIT_PER_USER - (usage?.mine ?? 0) - 1 });
});
