import { describe, expect, it } from 'vitest';
import { hasLocalChanges, mergeTable, mergeTombstones, tombstoneId, type Tombstone } from './merge';

const NOW = Date.UTC(2026, 10, 14);
const tomb = (registo: string, apagado_em: number): Tombstone => ({
  id: tombstoneId('compras', registo),
  tabela: 'compras',
  registo,
  apagado_em,
});

describe('juntar uma tabela', () => {
  it('traz da nuvem os registos que não existem aqui (faturas lidas no telemóvel)', () => {
    const r = mergeTable(
      'compras',
      [{ id: 'pc', atualizado_em: 1 }],
      [{ id: 'tel', atualizado_em: 2 }],
      new Map(),
    );
    expect(r).toEqual({ put: [{ id: 'tel', atualizado_em: 2 }], remove: [] });
  });

  it('em registos dos dois lados, ganha a alteração mais recente', () => {
    const local = [
      { id: 'a', atualizado_em: 10, v: 'aqui' },
      { id: 'b', atualizado_em: 30, v: 'aqui' },
    ];
    const remote = [
      { id: 'a', atualizado_em: 20, v: 'nuvem' },
      { id: 'b', atualizado_em: 25, v: 'nuvem' },
    ];
    expect(mergeTable('compras', local, remote, new Map()).put).toEqual([
      { id: 'a', atualizado_em: 20, v: 'nuvem' },
    ]);
  });

  it('registos antigos, sem hora de alteração, não substituem os deste dispositivo', () => {
    expect(mergeTable('compras', [{ id: 'a' }], [{ id: 'a' }], new Map()).put).toEqual([]);
  });

  it('um registo apagado noutro dispositivo é apagado aqui', () => {
    const tombs = mergeTombstones([], [tomb('a', 50)], 100);
    expect(mergeTable('compras', [{ id: 'a', atualizado_em: 40 }], [], tombs)).toEqual({
      put: [],
      remove: ['a'],
    });
  });

  it('um registo apagado aqui não volta da nuvem', () => {
    const tombs = mergeTombstones([tomb('a', 50)], [], 100);
    expect(mergeTable('compras', [], [{ id: 'a', atualizado_em: 40 }], tombs).put).toEqual([]);
  });

  it('um registo alterado depois de ter sido apagado noutro lado fica', () => {
    const tombs = mergeTombstones([], [tomb('a', 50)], 100);
    expect(mergeTable('compras', [{ id: 'a', atualizado_em: 60 }], [], tombs).remove).toEqual([]);
    expect(mergeTable('compras', [], [{ id: 'a', atualizado_em: 60 }], tombs).put).toHaveLength(1);
  });
});

describe('notas de apagamento', () => {
  it('fica a mais recente e esquecem-se as com mais de 180 dias', () => {
    const old = NOW - 181 * 86_400_000;
    const m = mergeTombstones([tomb('a', NOW - 10), tomb('b', old)], [tomb('a', NOW - 5)], NOW);
    expect([...m.values()]).toEqual([tomb('a', NOW - 5)]);
  });
});

describe('alterações por enviar', () => {
  it('há sempre na primeira sincronização', () => {
    expect(hasLocalChanges([[]], [], undefined)).toBe(true);
  });

  it('há quando um registo ou um apagamento é mais recente do que a última sincronização', () => {
    expect(hasLocalChanges([[{ id: 'a', atualizado_em: 5 }]], [], 10)).toBe(false);
    expect(hasLocalChanges([[{ id: 'a', atualizado_em: 15 }]], [], 10)).toBe(true);
    expect(hasLocalChanges([[]], [tomb('a', 15)], 10)).toBe(true);
  });
});
