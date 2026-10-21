import { Hono } from 'hono';
import { account } from './account';
import { admin } from './admin';
import { auth } from './auth';
import { backups } from './backup';
import { HttpError, requireAppHeader, type AppEnv } from './lib';
import { reports } from './reports';

export type { Env } from './lib';

// O resto do domínio (a PWA) é servido pelos static assets, sem passar por aqui.
const app = new Hono<AppEnv>().basePath('/api');

app.use('*', requireAppHeader);
app.use('*', async (c, next) => {
  await next();
  c.header('cache-control', c.res.headers.get('cache-control') ?? 'no-store');
});

app.get('/health', (c) => c.json({ ok: true, service: 'prazometro-api' }));
app.route('/auth', auth);
app.route('/account', account);
app.route('/backups', backups);
app.route('/reports', reports);
app.route('/admin', admin);

// Nunca devolver detalhes internos (nem registar dados pessoais): só a mensagem prevista.
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ erro: err.message }, err.status);
  console.error('erro interno', err instanceof Error ? err.name : 'desconhecido');
  return c.json({ erro: 'Ocorreu um erro. Tente outra vez.' }, 500);
});

export default app;
