import { todayInLisbon } from '@prazometro/engine';
import { useRef, useState } from 'react';
import { db, type Profile, type Purchase, type WaitRequest } from '../db';
import { downloadBlob } from '../download';

// Cópia de segurança num ficheiro, guardado onde a pessoa quiser. Não passa por nenhum servidor.

const FORMAT = 'prazometro-copia';

type BackupFile = {
  formato: typeof FORMAT;
  versao: 1;
  criado_em: string;
  compras: Purchase[];
  /** Opcional: as cópias feitas antes do módulo SNS não o têm. */
  pedidos_sns?: WaitRequest[];
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

export async function exportBackup(): Promise<Blob> {
  const [compras, pedidos_sns, perfil, ficheiros] = await Promise.all([
    db.compras.toArray(),
    db.pedidos_sns.toArray(),
    db.perfil.toArray(),
    db.ficheiros.toArray(),
  ]);
  const data: BackupFile = {
    formato: FORMAT,
    versao: 1,
    criado_em: todayInLisbon(),
    compras,
    pedidos_sns,
    perfil,
    ficheiros: await Promise.all(
      ficheiros.map(async (f) => ({
        id: f.id,
        nome: f.nome,
        tipo: f.tipo,
        base64: await toBase64(f.blob),
      })),
    ),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
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
  await db.transaction('rw', [db.compras, db.pedidos_sns, db.perfil, db.ficheiros], async () => {
    await db.compras.bulkPut(data.compras);
    await db.pedidos_sns.bulkPut(pedidos);
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

export function BackupPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'erro'; text: string }>();

  async function save() {
    setMessage(undefined);
    downloadBlob(await exportBackup(), `prazometro-copia-${todayInLisbon()}.json`);
    setMessage({
      kind: 'ok',
      text: 'Cópia guardada. Guarde o ficheiro num local seguro: tem os seus dados, incluindo faturas e pedidos no SNS.',
    });
  }

  async function restore(file: File) {
    setMessage(undefined);
    try {
      const n = await importBackup(await file.text());
      setMessage({
        kind: 'ok',
        text: `Cópia recuperada: ${n.compras} compra(s) e ${n.pedidos} pedido(s) no SNS.`,
      });
    } catch (e) {
      setMessage({ kind: 'erro', text: (e as Error).message });
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <details className="backup">
      <summary>Cópia de segurança</summary>
      <p>
        Os seus dados ficam só neste dispositivo. Faça uma cópia para um ficheiro para não os perder
        se mudar de telemóvel ou de computador.
      </p>
      <div className="actions">
        <button type="button" onClick={save}>
          Guardar uma cópia
        </button>
        <button type="button" onClick={() => input.current?.click()}>
          Recuperar uma cópia
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
        />
      </div>
      {message && (
        <p className={message.kind === 'ok' ? 'ok' : 'errors'} role="status">
          {message.text}
        </p>
      )}
    </details>
  );
}
