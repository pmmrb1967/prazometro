// Junção de duas cópias (este dispositivo e a nuvem), registo a registo. Cada registo guarda a
// hora da última alteração (atualizado_em) e cada apagamento deixa uma nota (apagados). Ganha
// sempre a alteração mais recente: um registo apagado só volta se for alterado depois.
// Sem dependências da base de dados, para poder ser testado.

export type Stamped = { id: string; atualizado_em?: number };

/** Nota de um registo apagado, para o apagar também nos outros dispositivos. */
export type Tombstone = {
  /** `${tabela}:${registo}` */
  id: string;
  tabela: string;
  registo: string;
  apagado_em: number;
};

/** As notas de apagamento ficam 180 dias: chega para os dispositivos se encontrarem. */
export const TOMBSTONE_DAYS = 180;

export const tombstoneId = (tabela: string, registo: string) => `${tabela}:${registo}`;

/** Junta as notas dos dois lados (fica a mais recente) e esquece as muito antigas. */
export function mergeTombstones(
  local: Tombstone[],
  remote: Tombstone[],
  now: number,
): Map<string, Tombstone> {
  const out = new Map<string, Tombstone>();
  const oldest = now - TOMBSTONE_DAYS * 86_400_000;
  for (const t of [...local, ...remote]) {
    if (t.apagado_em < oldest) continue;
    const seen = out.get(t.id);
    if (!seen || t.apagado_em > seen.apagado_em) out.set(t.id, t);
  }
  return out;
}

/**
 * O que mudar neste dispositivo numa tabela: registos a gravar (vindos da nuvem e mais
 * recentes) e registos a apagar (apagados noutro dispositivo depois da última alteração).
 */
export function mergeTable<T extends Stamped>(
  tabela: string,
  local: T[],
  remote: T[],
  tombstones: Map<string, Tombstone>,
): { put: T[]; remove: string[] } {
  const stamp = (r: Stamped | undefined) => r?.atualizado_em ?? 0;
  const deletedAt = (id: string) => tombstones.get(tombstoneId(tabela, id))?.apagado_em;
  const mine = new Map(local.map((r) => [r.id, r]));
  const put: T[] = [];
  for (const r of remote) {
    const gone = deletedAt(r.id);
    if (gone !== undefined && gone >= stamp(r)) continue;
    if (!mine.has(r.id) || stamp(r) > stamp(mine.get(r.id))) put.push(r);
  }
  const remove = local
    .filter((r) => {
      const gone = deletedAt(r.id);
      return gone !== undefined && gone >= stamp(r);
    })
    .map((r) => r.id);
  return { put, remove };
}

/** Há alterações neste dispositivo que a nuvem ainda não tem? */
export function hasLocalChanges(
  tables: Stamped[][],
  tombstones: Tombstone[],
  since: number | undefined,
): boolean {
  if (since === undefined) return true;
  return (
    tables.some((rows) => rows.some((r) => (r.atualizado_em ?? 0) > since)) ||
    tombstones.some((t) => t.apagado_em > since)
  );
}
