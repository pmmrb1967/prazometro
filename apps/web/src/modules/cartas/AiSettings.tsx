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
  freeStatus,
  keyHint,
  loadSettings,
  MODEL_OPTIONS,
  modelOf,
  PROVIDER_LABELS,
  readKey,
  removeKey,
  saveKey,
  testKey,
  type FreeStatus,
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
    [
      'workers-ai',
      `${PROVIDER_LABELS['workers-ai']}: sem chave nem conta, com um limite de leituras por dia`,
    ],
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
    ['none', `${PROVIDER_LABELS.none}: só palavras-chave, a carta nunca sai do telemóvel`],
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

      {provider === 'workers-ai' && <FreeAi />}

      {provider === 'gemini-admin' && (
        <p>
          A IA do Prazómetro só funciona com sessão iniciada na <Link to="/conta">conta</Link>, e
          tem um limite de leituras por dia.
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

/** IA gratuita: explica os limites e mostra quantas leituras restam hoje neste dispositivo. */
function FreeAi() {
  const [status, setStatus] = useState<FreeStatus>();
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string>();

  async function check() {
    setTesting(true);
    setError(undefined);
    try {
      setStatus(await freeStatus());
    } catch (err) {
      setStatus(undefined);
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  // Ao abrir, mostra logo quantas leituras restam (sem o estado "a testar").
  useEffect(() => {
    let alive = true;
    freeStatus().then(
      (s) => alive && setStatus(s),
      (err: Error) => alive && setError(err.message),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-labelledby="gratuita">
      <h2 id="gratuita">IA gratuita</h2>
      <p>
        Não precisa de chave nem de conta. O texto da carta, já sem dados pessoais, é lido pela IA
        da Cloudflare, que aloja o Prazómetro, e não fica guardado. Há um limite de leituras por dia
        em cada dispositivo e outro para todos: se esgotar, pode usar a sua chave ou ler sem IA.
      </p>
      <div className="actions">
        <button type="button" onClick={check} disabled={testing}>
          {testing ? 'A testar…' : 'Testar ligação'}
        </button>
      </div>
      {status && (
        <p className={status.disponivel ? 'ok' : 'errors'} role="status">
          {status.disponivel
            ? `A IA gratuita está disponível. Hoje restam ${status.restantes} de ${status.limite_diario} leituras neste dispositivo.`
            : 'Hoje a IA gratuita não está disponível. Pode usar a sua chave ou ler sem IA.'}
        </p>
      )}
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function OwnKey({ provider }: { provider: OwnProvider }) {
  const settings = useLiveQuery(() => db.ia.get('ia'));
  const [key, setKey] = useState('');
  const [state, setState] = useState<'idle' | 'testing' | 'ok'>('idle');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [hint, setHint] = useState<string>();
  const stored = provider === 'gemini-own' ? settings?.chave_gemini : settings?.chave_claude;

  // A chave guardada só se mostra pelos últimos 4 caracteres (decifrada aqui, no dispositivo).
  useEffect(() => {
    let alive = true;
    (stored ? readKey(provider) : Promise.resolve(undefined)).then(
      (k) => alive && setHint(k ? keyHint(k) : undefined),
      () => alive && setHint(undefined),
    );
    return () => {
      alive = false;
    };
  }, [provider, stored]);

  if (!settings) return null;
  const modelField = provider === 'gemini-own' ? 'modelo_gemini' : 'modelo_claude';
  const link = KEY_LINKS[provider];
  const current = modelOf(settings, provider);
  // Um modelo escrito antes à mão continua na lista, para não mudar sem a pessoa saber.
  const models = MODEL_OPTIONS[provider].some((m) => m.id === current)
    ? MODEL_OPTIONS[provider]
    : [...MODEL_OPTIONS[provider], { id: current, label: current }];

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
      {provider === 'gemini-own' && (
        <p className="notice">
          Atenção: na União Europeia, os termos da Google só permitem usar o Gemini numa app como
          esta com a faturação ativa (paga) num projeto do Google Cloud. A chave gratuita do Google
          AI Studio não serve. Se não tiver faturação ativa, use a IA gratuita do Prazómetro.
        </p>
      )}
      <form className="form" onSubmit={save}>
        <label className="field">
          {stored ? 'Substituir a chave' : 'Chave'}
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={hint ?? (provider === 'gemini-own' ? 'AIza…' : 'sk-ant-…')}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label className="field">
          Modelo
          <select
            value={current}
            onChange={(e) =>
              db.ia.update('ia', {
                [modelField]: e.target.value === models[0]!.id ? undefined : e.target.value,
              })
            }
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
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
        {stored && !message && (
          <p className="hint">
            Há uma chave guardada{hint ? `, terminada em ${hint.slice(-4)}` : ''}.
          </p>
        )}
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
