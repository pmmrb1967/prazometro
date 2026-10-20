import { Hono } from 'hono';

export type Env = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ ok: true, service: 'prazometro-api' }));

export default app;
