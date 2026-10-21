import { todayInLisbon } from '@prazometro/engine';
import {
  db,
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
  perfil: Profile[];
  ficheiros: { id: string; nome: string; tipo: string; base64: string }[];
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
  const [compras, pedidos_sns, cartas, perfil, ficheiros] = await Promise.all([
    db.compras.toArray(),
    db.pedidos_sns.toArray(),
    db.cartas.toArray(),
    db.perfil.toArray(),
    withFiles ? db.ficheiros.toArray() : Promise.resolve([]),
  ]);
  const data: BackupFile = {
    formato: FORMAT,
    versao: 1,
    criado_em: todayInLisbon(),
    compras,
    pedidos_sns,
    cartas,
    perfil,
    ficheiros: await Promise.all(
      ficheiros.map(async (original) => {
        const f = converter ? await converter(original) : original;
        return { id: f.id, nome: f.nome, tipo: f.tipo, base64: await toBase64(f.blob) };
      }),
    ),
  };
  return JSON.stringify(data);
}

/** Junta a cópia aos dados existentes; registos com o mesmo id ficam com a versão da cópia. */
export async function importBackup(text: string): Promise<{ compras: number; pedidos: number }> {
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
  const pedidos = data.pedidos_sns ?? [];
  const tables = [db.compras, db.pedidos_sns, db.cartas, db.perfil, db.ficheiros];
  await db.transaction('rw', tables, async () => {
    await db.compras.bulkPut(data.compras);
    await db.pedidos_sns.bulkPut(pedidos);
    await db.cartas.bulkPut(data.cartas ?? []);
    await db.perfil.bulkPut(data.perfil ?? []);
    await db.ficheiros.bulkPut(
      (data.ficheiros ?? []).map((f) => ({
        id: f.id,
        nome: f.nome,
        tipo: f.tipo,
        blob: fromBase64(f.base64, f.tipo),
      })),
    );
  });
  return { compras: data.compras.length, pedidos: pedidos.length };
}
