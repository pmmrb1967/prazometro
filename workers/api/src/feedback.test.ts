import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client, testDb } from './testing';

let DB: D1Database;
let dispose: () => Promise<void>;
beforeEach(async () => ({ DB, dispose } = await testDb()));
afterEach(() => dispose());

describe('opiniões sobre a app', () => {
  it('guarda o tema e o texto, sem conta', async () => {
    const res = await new Client(DB).call('/feedback', {
      json: { modulo: 'sns', message: 'Não percebi o que é o TMRG.' },
    });
    expect(res.status).toBe(200);
    const row = await DB.prepare('SELECT rule_id, message, status FROM rule_reports').first();
    expect(row).toEqual({
      rule_id: 'opiniao.sns',
      message: 'Não percebi o que é o TMRG.',
      status: 'novo',
    });
  });

  it('recusa temas desconhecidos e textos curtos', async () => {
    const client = new Client(DB);
    expect(
      (await client.call('/feedback', { json: { modulo: 'outro', message: 'Texto suficiente.' } }))
        .status,
    ).toBe(400);
    expect(
      (await client.call('/feedback', { json: { modulo: 'geral', message: 'curto' } })).status,
    ).toBe(400);
  });
});
