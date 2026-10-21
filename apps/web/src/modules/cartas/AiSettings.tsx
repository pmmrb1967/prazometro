import type { AiProvider } from '@prazometro/ai';
import { todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Choice } from '../../components/Choice';
import { LegalNotice } from '../../components/LegalNotice';
import { api } from '../../cloud/api';
import { db } from '../../db';
import { Link, usePageHeading } from '../../router';
import {
  loadSettings,
  modelOf,
  PROVIDER_LABELS,
  readKey,
  removeKey,
  saveKey,
  testKey,
  type OwnProvider,
} from './aiConfig';

const KEY_LINKS: Record<OwnProvider, { url: string; texto: string }> = {
  'gemini-own': { url: 'https://aistudio.google.com/apikey', texto: 'Google AI Studio' },
  'claude-own': {
    url: 'https://console.anthropic.com/settings/keys',
    texto: 'consola da Claude Platform',
  },
};

export default function AiSettings() {
  const heading = usePageHeading<HTMLHeadingElement>('Definições da IA');
  const settings = useLiveQuery(() => db.ia.get('ia'));
  const [adminAvailable, setAdminAvailable] = useState(false);

  useEffect(() => {
    // Cria a configuração (e a chave local) na primeira visita; a consulta acima atualiza-se.
    loadSettings();
    api<{ disponivel: boolean }>('/ai/status')
      .then((s) => setAdminAvailable(s.disponivel))
      .catch(() => setAdminAvailable(false));
  }, []);

  if (!settings) return null;
  const provider = settings.fornecedor;
  const options: [AiProvider, string][] = [
    ['none', `${PROVIDER_LABELS.none}: só palavras-chave, a carta nunca sai do telemóvel`],
    ...(adminAvailable || provider === 'gemini-admin'
      ? ([
          [
            'gemini-admin',
            `${PROVIDER_LABELS['gemini-admin']}: gratuita, com conta e limite diário`,
          ],
        ] as [AiProvider, string][])
      : []),
    ['gemini-own', PROVIDER_LABELS['gemini-own']],
    ['claude-own', PROVIDER_LABELS['claude-own']],
  ];

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/cartas">Perceber uma carta</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Definições da IA
      </h1>
      <p className="lead">
        Sem IA, a app reconhece quem enviou a carta e as datas por palavras-chave. Com IA, o resumo
        é mais completo. O prazo é sempre calculado pelo Prazómetro, nunca pela IA.
      </p>

      <Choice
        legend="Como quer ler as cartas?"
        name="fornecedor"
        value={provider}
        options={options}
        onChange={(v) => db.ia.update('ia', { fornecedor: v })}
      />

      {provider !== 'none' && (
        <p className="notice">
          Antes de qualquer envio, a app retira do texto nomes, moradas, NIF, NISS, IBAN,
          matrículas, números de processo e contactos, e mostra-lhe o que vai ser enviado. A
          fotografia nunca é enviada.
        </p>
      )}

      {provider === 'gemini-admin' && (
        <p>
          A IA do Prazómetro só funciona com sessão iniciada na{' '}
          <Link to="/copia">Cópia na nuvem</Link>, e tem um limite de leituras por dia.
        </p>
      )}

      {(provider === 'gemini-own' || provider === 'claude-own') && (
        <OwnKey key={provider} provider={provider} />
      )}

      <section aria-labelledby="uso">
        <h2 id="uso">Uso neste dispositivo</h2>
        {Object.keys(settings.uso).length === 0 ? (
          <p>Ainda não leu nenhuma carta com IA.</p>
        ) : (
          <ul className="links">
            {(
              Object.entries(settings.uso) as [
                AiProvider,
                { hoje: number; total: number; dia: string },
              ][]
            ).map(([p, u]) => (
              <li key={p}>
                {PROVIDER_LABELS[p]}: {u.dia === todayInLisbon() ? u.hoje : 0} hoje, {u.total} no
                total.
              </li>
            ))}
          </ul>
        )}
      </section>

      <LegalNotice />
    </>
  );
}

function OwnKey({ provider }: { provider: OwnProvider }) {
  const settings = useLiveQuery(() => db.ia.get('ia'));
  const [key, setKey] = useState('');
  const [state, setState] = useState<'idle' | 'testing' | 'ok'>('idle');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  if (!settings) return null;
  const stored = provider === 'gemini-own' ? settings.chave_gemini : settings.chave_claude;
  const modelField = provider === 'gemini-own' ? 'modelo_gemini' : 'modelo_claude';
  const link = KEY_LINKS[provider];

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    await saveKey(provider, key);
    setKey('');
    setMessage('Chave guardada neste dispositivo, cifrada.');
  }

  async function test() {
    setState('testing');
    setError(undefined);
    setMessage(undefined);
    try {
      const k = key.trim() || (await readKey(provider));
      if (!k) throw new Error('Cole primeiro a chave.');
      await testKey(provider, k, modelOf(settings!, provider));
      setState('ok');
      setMessage('A chave funciona.');
    } catch (err) {
      setState('idle');
      setError((err as Error).message);
    }
  }

  return (
    <section aria-labelledby="chave">
      <h2 id="chave">A sua chave</h2>
      <p>
        Crie uma chave na{' '}
        <a href={link.url} target="_blank" rel="noreferrer">
          {link.texto}
        </a>{' '}
        e cole-a aqui. A chave fica só neste dispositivo, cifrada, e a carta vai diretamente do seu
        telemóvel para {provider === 'gemini-own' ? 'a Google' : 'a Anthropic'}, sem passar pelo
        Prazómetro. O uso conta na sua conta{' '}
        {provider === 'gemini-own' ? 'Google' : 'da Claude Platform'}.
      </p>
      <form className="form" onSubmit={save}>
        <label className="field">
          {stored ? 'Substituir a chave' : 'Chave'}
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label className="field">
          Modelo <span className="optional">(opcional)</span>
          <input
            type="text"
            value={settings[modelField] ?? ''}
            placeholder={modelOf({ ...settings, [modelField]: undefined }, provider)}
            onChange={(e) =>
              db.ia.update('ia', { [modelField]: e.target.value.trim() || undefined })
            }
            spellCheck={false}
          />
        </label>
        <div className="actions">
          <button type="submit" className="primary">
            Guardar chave
          </button>
          <button type="button" onClick={test} disabled={state === 'testing'}>
            {state === 'testing' ? 'A testar…' : 'Testar chave'}
          </button>
          {stored && (
            <button
              type="button"
              onClick={async () => {
                await removeKey(provider);
                setMessage('Chave apagada.');
              }}
            >
              Apagar a chave
            </button>
          )}
        </div>
        {stored && !message && <p className="hint">Há uma chave guardada.</p>}
        {message && (
          <p className="ok" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
