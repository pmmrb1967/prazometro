import { todayInLisbon } from '@prazometro/engine';
import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../backupData';
import { downloadBlob } from '../download';
import { Link } from '../router';

export function BackupPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'erro'; text: string }>();

  async function save() {
    setMessage(undefined);
    downloadBlob(
      new Blob([await exportBackup()], { type: 'application/json' }),
      `prazometro-copia-${todayInLisbon()}.json`,
    );
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
      <p>
        Também pode guardar uma <Link to="/conta">cópia na nuvem, cifrada</Link>, para recuperar
        tudo noutro telemóvel.
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
