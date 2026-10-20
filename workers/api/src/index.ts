import { Hono } from 'hono';

export type Env = {
  DB: D1Database;
};

// O resto do domínio (a PWA) é servido pelos static assets, sem passar por aqui.
const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.get('/health', (c) => c.json({ ok: true, service: 'prazometro-api' }));

export default app;
