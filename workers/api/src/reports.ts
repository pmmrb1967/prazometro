import { Hono } from 'hono';
import { z } from 'zod';
import { utcDate } from '../../monitor/src/limits';
import { HttpError, now, randomId, type AppEnv } from './lib';

// "Esta regra parece desatualizada?": qualquer pessoa pode avisar, sem conta.
// Guarda-se só o id da regra e a mensagem (a pessoa é avisada para não escrever dados pessoais).

/** Máximo de relatos por dia, para todos (trava abusos sem precisar de conta). */
export const REPORTS_PER_DAY = 100;

export const ReportSchema = z.object({
  rule_id: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]+\.[a-z0-9-]+$/),
  message: z.string().trim().min(10).max(1000),
});

/** Temas das opiniões sobre a app (guardadas como relatos "opiniao.<tema>"). */
export const FEEDBACK_TOPICS = [
  'geral',
  'garantia',
  'sns',
  'cartas',
  'pos-obito',
  'partilha',
] as const;

export const FeedbackSchema = z.object({
  modulo: z.enum(FEEDBACK_TOPICS),
  message: z.string().trim().min(10).max(1000),
});

export const reports = new Hono<AppEnv>();

reports.post('/', async (c) => {
  const parsed = ReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(400, 'Escreva pelo menos 10 caracteres (no máximo 1000).');
  }
  await save(c.env.DB, parsed.data.rule_id, parsed.data.message);
  return c.json({ ok: true });
});

/** "Dar a sua opinião": como os relatos, sem conta e só com o texto e a data. */
export const feedback = new Hono<AppEnv>();

feedback.post('/', async (c) => {
  const parsed = FeedbackSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HttpError(400, 'Escreva pelo menos 10 caracteres (no máximo 1000).');
  }
  await save(c.env.DB, `opiniao.${parsed.data.modulo}`, parsed.data.message);
  return c.json({ ok: true });
});

async function save(db: D1Database, ruleId: string, message: string) {
  const t = now();
  const dayStart = Date.parse(utcDate(t)) / 1000;
  const today = await db
    .prepare('SELECT COUNT(*) AS n FROM rule_reports WHERE created_at >= ?')
    .bind(dayStart)
    .first<{ n: number }>();
  if ((today?.n ?? 0) >= REPORTS_PER_DAY) {
    throw new HttpError(503, 'Hoje já recebemos muitas mensagens. Tente outra vez amanhã.');
  }
  await db
    .prepare('INSERT INTO rule_reports (id, rule_id, message, created_at) VALUES (?, ?, ?, ?)')
    .bind(randomId(), ruleId, message, t)
    .run();
}
