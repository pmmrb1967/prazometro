import { todayInLisbon } from '@prazometro/engine';
import { mergeTable, mergeTombstones, type Tombstone } from './cloud/merge';
import {
  applyRemote,
  db,
  SYNCED_TABLES,
  type Synced,
  type SyncedTable,
  type DeathProcess,
  type Profile,
  type Purchase,
  type ReceivedLetter,
  type StoredFile,
  type WaitRequest,
} from './db';

// Conteúdo das cópias de segurança: o mesmo JSON serve para o ficheiro local e para a nuvem
// (onde é cifrado no dispositivo antes de sair).

const FORMAT = 'prazometro-copia';

type BackupFile = {
  formato: typeof FORMAT;
  versao: 1;
  criado_em: string;
  compras: Purchase[];
  /** Opcional: as cópias feitas antes do módulo SNS não o têm. */
  pedidos_sns?: WaitRequest[];
  /** Opcional: as cópias feitas antes do módulo Cartas não o têm. */
  cartas?: ReceivedLetter[];
  /** Opcional: as cópias feitas antes do módulo Pós-óbito não o têm. */
  processos_obito?: DeathProcess[];
  perfil: Profile[];
  ficheiros: { id: string; nome: string; tipo: string; base64: string; atualizado_em?: number }[];
  /** Notas de registos apagados, para os apagar também nos outros dispositivos. */
  apagados?: Tombstone[];
};

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export type ExportOptions = {
  /** Incluir as fotografias e PDF das faturas (por defeito, sim). */
  ficheiros?: boolean;
  /** Transformar cada ficheiro antes de o incluir (por exemplo, comprimir fotografias). */
  converter?: (f: StoredFile) => Promise<StoredFile>;
};

export async function exportBackup({
  ficheiros: withFiles = true,
  converter,
}: ExportOptions = {}): Promise<string> {
  // A configuração da IA (com as chaves) fica fora das cópias, de propósito.
  const [compras, pedidos_sns, cartas, processos_obito, perfil, ficheiros, apagados] =
    await Promise.all([
      db.compras.toArray(),
      db.pedidos_sns.toArray(),
      db.cartas.toArray(),
      db.processos_obito.toArray(),
      db.perfil.toArray(),
      withFiles ? db.ficheiros.toArray() : Promise.resolve([]),
      db.apagados.toArray(),
    ]);
  const data: BackupFile = {
    formato: FORMAT,
    versao: 1,
    criado_em: todayInLisbon(),
    compras,
    pedidos_sns,
    cartas,
    processos_obito,
    perfil,
    ficheiros: await Promise.all(
      ficheiros.map(async (original) => {
        const f = converter ? await converter(original) : original;
        return {
          id: f.id,
          nome: f.nome,
          tipo: f.tipo,
          base64: await toBase64(f.blob),
          atualizado_em: original.atualizado_em,
        };
      }),
    ),
    apagados,
  };
  return JSON.stringify(data);
}

export type ImportResult = {
  compras: number;
  pedidos: number;
  cartas: number;
  processos: number;
  alterados: number;
};

/**
 * Junta a cópia aos dados deste dispositivo, registo a registo: fica a alteração mais recente
 * de cada um e os registos apagados noutro dispositivo são apagados aqui (cloud/merge.ts).
 */
export async function importBackup(text: string): Promise<ImportResult> {
  let data: BackupFile;
  try {
    data = JSON.parse(text) as BackupFile;
  } catch {
    throw new Error('O ficheiro não é uma cópia de segurança do Prazómetro.');
  }
  if (data?.formato !== FORMAT || !Array.isArray(data.compras)) {
    throw new Error('O ficheiro não é uma cópia de segurança do Prazómetro.');
  }
  if (data.versao !== 1)
    throw new Error('Esta cópia foi feita por uma versão mais recente da app.');

  const remote: Record<SyncedTable, (Synced & { id: string })[]> = {
    compras: data.compras,
    pedidos_sns: data.pedidos_sns ?? [],
    cartas: data.cartas ?? [],
    processos_obito: data.processos_obito ?? [],
    perfil: data.perfil ?? [],
    ficheiros: (data.ficheiros ?? []).map((f) => ({
      id: f.id,
      nome: f.nome,
      tipo: f.tipo,
      atualizado_em: f.atualizado_em,
      blob: fromBase64(f.base64, f.tipo),
    })),
  };
  let alterados = 0;
  await applyRemote(() =>
    db.transaction('rw', [...SYNCED_TABLES.map((t) => db.table(t)), db.apagados], async () => {
      const tombstones = mergeTombstones(
        await db.apagados.toArray(),
        data.apagados ?? [],
        Date.now(),
      );
      await db.apagados.clear();
      await db.apagados.bulkPut([...tombstones.values()]);
      for (const name of SYNCED_TABLES) {
        const table = db.table<Synced & { id: string }, string>(name);
        const { put, remove } = mergeTable(name, await table.toArray(), remote[name], tombstones);
        await table.bulkPut(put);
        await table.bulkDelete(remove);
        alterados += put.length + remove.length;
      }
    }),
  );
  return {
    compras: data.compras.length,
    pedidos: remote.pedidos_sns.length,
    cartas: remote.cartas.length,
    processos: remote.processos_obito.length,
    alterados,
  };
}

/** "3 compras, 1 carta e 1 processo de falecimento" (só o que existe). */
export function describeCounts(n: Omit<ImportResult, 'alterados'>): string {
  const parts = [
    [n.compras, 'compra', 'compras'],
    [n.pedidos, 'pedido no SNS', 'pedidos no SNS'],
    [n.cartas, 'carta', 'cartas'],
    [n.processos, 'processo de falecimento', 'processos de falecimento'],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);
  if (parts.length === 0) return 'nenhum registo';
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
}

/** Quantos registos há neste dispositivo, por módulo. */
export async function countAll(): Promise<Omit<ImportResult, 'alterados'>> {
  const [compras, pedidos, cartas, processos] = await Promise.all([
    db.compras.count(),
    db.pedidos_sns.count(),
    db.cartas.count(),
    db.processos_obito.count(),
  ]);
  return { compras, pedidos, cartas, processos };
}
