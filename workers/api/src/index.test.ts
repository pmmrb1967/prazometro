import { describe, expect, it } from 'vitest';
import app from './index';

describe('GET /api/health', () => {
  it('responde ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'prazometro-api' });
  });

  it('não responde fora de /api', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(404);
  });
});
