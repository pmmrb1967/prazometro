import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { LegalNotice } from '../components/LegalNotice';
import { countAll, describeCounts } from '../backupData';
import { db } from '../db';
import { downloadBlob } from '../download';
import { PROVIDER_LABELS } from '../modules/cartas/aiConfig';
import { Link, usePageHeading } from '../router';
import {
  addPasskey,
  currentAccount,
  deleteAccount,
  generateRecoveryCode,
  loginWithCode,
  loginWithPasskey,
  logout,
  passkeyErrorMessage,
  register,
  replaceRecoveryCode,
  unlockWithCode,
  synchronize,
  uploadBackup,
  type Account,
} from './cloud';

type Message = { kind: 'ok' | 'erro'; text: string };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function formatWhen(iso: string | number) {
  const d = typeof iso === 'number' ? new Date(iso * 1000) : new Date(iso);
  return d.toLocaleString('pt-PT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Lisbon',
  });
}

function Status({ message }: { message?: Message }) {
  if (!message) return null;
  return (
    <p className={message.kind === 'ok' ? 'ok' : 'errors'} role="status">
      {message.text}
    </p>
  );
}

/** Mostra o código de recuperação, com PDF para imprimir, e pede confirmação de que foi guardado. */
function RecoveryCodeBox({
  code,
  confirmLabel,
  onConfirm,
  busy,
}: {
  code: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function pdf() {
    const { letterPdf } = await import('../letters');
    const text = [
      '# Código de recuperação do Prazómetro',
      '',
      `## ${code}`,
      '',
      'Este código permite recuperar a sua cópia de segurança noutro telemóvel ou computador.',
      'Guarde esta folha num local seguro, junto dos seus documentos importantes.',
      'Não o partilhe com ninguém: quem tiver o código pode ver os seus dados.',
      '',
      'Se perder o código e a passkey, não há forma de recuperar a cópia, nem pelo Prazómetro.',
      '',
      'Endereço: https://app.prazometro.workers.dev/conta',
    ].join('\n');
    downloadBlob(
      await letterPdf(text, 'Código de recuperação do Prazómetro'),
      'prazometro-codigo-recuperacao.pdf',
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="recovery">
      <p>O seu código de recuperação:</p>
      <p className="recovery-code" aria-label={`Código: ${code.split('').join(' ')}`}>
        {code.split('-').map((group, i, all) => (
          <span key={i}>
            {group}
            {i < all.length - 1 ? '-' : ''}
          </span>
        ))}
      </p>
      <p>
        <strong>Guarde-o num local seguro</strong>: imprima-o ou escreva-o num papel. Vai precisar
        dele se mudar de telemóvel e a passkey não passar para o novo. Se perder o código e a
        passkey, ninguém consegue recuperar a cópia, nem o Prazómetro.
      </p>
      <div className="actions">
        <button type="button" onClick={pdf}>
          Descarregar em PDF para imprimir
        </button>
        <button type="button" onClick={copy}>
          {copied ? 'Copiado' : 'Copiar o código'}
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        Já guardei o código num local seguro
      </label>
      <div className="actions">
        <button type="button" className="primary" disabled={!saved || busy} onClick={onConfirm}>
          {busy ? 'Um momento…' : confirmLabel}
        </button>
      </div>
    </div>
  );
}

function CodeForm({
  label,
  button,
  onSubmit,
}: {
  label: string;
  button: string;
  onSubmit: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(undefined);
    try {
      await onSubmit(code);
    } catch (err) {
      setMessage({ kind: 'erro', text: passkeyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        {label}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
        />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Um momento…' : button}
        </button>
      </div>
      <Status message={message} />
    </form>
  );
}

function SignedOut({ onSignedIn }: { onSignedIn: () => void }) {
  const [step, setStep] = useState<'inicio' | 'criar' | 'codigo'>('inicio');
  const [code] = useState(generateRecoveryCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>();
  const webauthn = browserSupportsWebAuthn();

  async function create() {
    setBusy(true);
    setMessage(undefined);
    try {
      await register(code);
      await uploadBackup(true).catch(() => undefined);
      onSignedIn();
    } catch (e) {
      setMessage({ kind: 'erro', text: passkeyErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setMessage(undefined);
    try {
      await loginWithPasskey();
      onSignedIn();
    } catch (e) {
      setMessage({ kind: 'erro', text: passkeyErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (step === 'criar') {
    return (
      <section aria-labelledby="criar">
        <h2 id="criar">1. Guarde o código de recuperação</h2>
        <RecoveryCodeBox
          code={code}
          confirmLabel="Continuar: criar a passkey"
          onConfirm={create}
          busy={busy}
        />
        <p className="hint">
          A seguir, o telemóvel pede a impressão digital, o rosto ou o código de desbloqueio para
          criar a passkey. É assim que vai entrar, sem palavra-passe.
        </p>
        <Status message={message} />
        <button type="button" onClick={() => setStep('inicio')}>
          Voltar
        </button>
      </section>
    );
  }

  if (step === 'codigo') {
    return (
      <section aria-labelledby="codigo">
        <h2 id="codigo">Entrar com o código de recuperação</h2>
        <CodeForm
          label="Escreva o código de recuperação"
          button="Entrar"
          onSubmit={async (c) => {
            await loginWithCode(c);
            onSignedIn();
          }}
        />
        <button type="button" onClick={() => setStep('inicio')}>
          Voltar
        </button>
      </section>
    );
  }

  return (
    <>
      <section aria-labelledby="maneiras">
        <h2 id="maneiras">Três maneiras de usar</h2>
        <ul className="ways">
          <li>
            <h3>Sem conta</h3>
            <p>
              Pode usar tudo sem conta. Os dados ficam só neste dispositivo: se mudar de telemóvel
              ou o perder, perde-os.
            </p>
          </li>
          <li>
            <h3>Com conta</h3>
            <p>
              Guarda uma cópia cifrada dos seus dados, para os recuperar noutro telemóvel. Entra com
              a impressão digital ou o rosto, sem email nem palavra-passe.
            </p>
          </li>
          <li>
            <h3>Com a família</h3>
            <p>
              Com conta, pode partilhar os seus prazos com um familiar. Quem recebe não precisa de
              conta.
            </p>
          </li>
        </ul>
      </section>
      <section aria-labelledby="novo">
        <h2 id="novo">Criar conta</h2>
        <p>
          Os dados são cifrados neste dispositivo antes de saírem. O servidor guarda só um ficheiro
          ilegível: nem o Prazómetro consegue ver as suas compras, pedidos ou faturas.
        </p>
        {webauthn ? (
          <div className="actions">
            <button type="button" className="primary" onClick={() => setStep('criar')}>
              Criar conta
            </button>
          </div>
        ) : (
          <p className="notice">
            Este navegador não suporta passkeys. Experimente no Chrome, Edge, Safari ou Samsung
            Internet atualizados.
          </p>
        )}
      </section>
      <section aria-labelledby="ja-tenho">
        <h2 id="ja-tenho">Já tem conta</h2>
        <div className="actions">
          {webauthn && (
            <button type="button" onClick={login} disabled={busy}>
              {busy ? 'Um momento…' : 'Entrar com a passkey'}
            </button>
          )}
          <button type="button" onClick={() => setStep('codigo')}>
            Entrar com o código de recuperação
          </button>
        </div>
        <Status message={message} />
      </section>
    </>
  );
}

function SignedIn({
  account,
  onChange,
  onSignedOut,
}: {
  account: Account;
  onChange: () => void;
  onSignedOut: () => void;
}) {
  const state = useLiveQuery(() => db.nuvem.get('nuvem'), [], null);
  const [fotosChoice, setFotos] = useState<boolean>();
  const [busy, setBusy] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const [message, setMessage] = useState<Message>();
  const [newCode, setNewCode] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Primeira vez neste dispositivo (por exemplo, logo depois de escrever o código de
  // recuperação): sincroniza já, sem esperar que a pessoa carregue no botão.
  const firstSync = useRef(false);
  const needsFirstSync = !!state && state.sincronizado_em === undefined;
  useEffect(() => {
    if (!needsFirstSync || firstSync.current) return;
    firstSync.current = true;
    void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsFirstSync]);

  if (state === null) return null;
  const fotos = fotosChoice ?? state?.incluir_fotos ?? true;

  async function run(label: string, action: () => Promise<Message | void>) {
    setBusy(label);
    setMessage(undefined);
    try {
      const m = await action();
      if (m) setMessage(m);
      onChange();
    } catch (e) {
      setMessage({ kind: 'erro', text: passkeyErrorMessage(e) });
    } finally {
      setBusy(undefined);
      setProgress(undefined);
    }
  }

  const onProgress = (verb: string) => (done: number, total: number) =>
    setProgress(total > 1 ? `${verb}: ${done} de ${total} partes` : `${verb}…`);

  function sync() {
    return run('sincronizar', async () => {
      const r = await synchronize((fase, done, total) => onProgress(fase)(done, total));
      const counts = describeCounts(await countAll());
      return {
        kind: 'ok',
        text:
          (r.recebidos > 0
            ? `Sincronizado: ${r.recebidos} alteração(ões) recebida(s) de outro dispositivo.`
            : r.enviado
              ? 'Sincronizado: as alterações deste dispositivo foram enviadas.'
              : 'Sincronizado: não havia nada de novo.') + ` Neste dispositivo: ${counts}.`,
      };
    });
  }

  if (!state) {
    return (
      <section aria-labelledby="desbloquear">
        <h2 id="desbloquear">Falta a chave neste dispositivo</h2>
        <p>
          Entrou na conta, mas este dispositivo ainda não tem a chave para ler a cópia. Escreva o
          código de recuperação (só é preciso uma vez por dispositivo).
        </p>
        <CodeForm label="Código de recuperação" button="Continuar" onSubmit={unlockWithCode} />
        <button
          type="button"
          onClick={() =>
            run('sair', async () => {
              await logout();
              onSignedOut();
            })
          }
        >
          Terminar sessão
        </button>
      </section>
    );
  }

  return (
    <>
      <section aria-labelledby="estado">
        <h2 id="estado">Sincronizar os dispositivos</h2>
        <p>
          A app junta os dados deste dispositivo com a cópia cifrada na nuvem e envia o resultado.
          Assim vê no computador as faturas e as cartas que leu no telemóvel, e ao contrário. Se o
          mesmo registo for alterado nos dois, fica a alteração mais recente. O que apagar num
          dispositivo também desaparece dos outros.
        </p>
        <p>
          {state.sincronizado_em ? (
            <>
              Última sincronização: <strong>{formatWhen(state.sincronizado_em / 1000)}</strong>
              {account.copia && <> ({formatSize(account.copia.size)} na nuvem)</>}.
            </>
          ) : account.copia ? (
            <>
              Este dispositivo ainda não foi sincronizado. Última cópia na nuvem:{' '}
              <strong>{formatWhen(account.copia.created_at)}</strong>.
            </>
          ) : (
            'Ainda não há nenhuma cópia na nuvem.'
          )}
        </p>
        <div className="actions">
          <button type="button" className="primary" disabled={!!busy} onClick={sync}>
            {busy === 'sincronizar' ? 'A sincronizar…' : 'Sincronizar agora'}
          </button>
        </div>
        {progress && <p role="status">{progress}</p>}
        <Status message={message} />
        <label className="check">
          <input
            type="checkbox"
            checked={state.sincronizar_sozinho !== false}
            onChange={(e) =>
              void db.nuvem.update('nuvem', { sincronizar_sozinho: e.target.checked })
            }
          />
          Sincronizar sozinho ao abrir e ao sair da app
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={fotos}
            onChange={(e) => {
              setFotos(e.target.checked);
              void db.nuvem.update('nuvem', { incluir_fotos: e.target.checked });
            }}
          />
          Incluir as fotografias das faturas (comprimidas, ocupam mais espaço)
        </label>
      </section>

      <section aria-labelledby="familia">
        <h2 id="familia">Partilhar com a família</h2>
        <p>
          Um familiar acompanha os seus prazos no telemóvel dele. Os dados vão cifrados e pode
          retirar o acesso quando quiser.
        </p>
        <div className="actions">
          <Link to="/partilhar" className="button">
            Partilhar com a família
          </Link>
          <Link to="/partilhas" className="button">
            Partilhas que recebeu
          </Link>
        </div>
      </section>

      <AiSummary />

      {account.papel === 'admin' && (
        <section aria-labelledby="admin">
          <h2 id="admin">Painel de admin</h2>
          <p>
            {account.sessao === 'passkey'
              ? 'Uso do plano gratuito, alertas e relatos.'
              : 'Para abrir o painel, termine a sessão e entre outra vez com a passkey.'}
          </p>
          {account.sessao === 'passkey' && (
            <div className="actions">
              <Link to="/admin" className="button">
                Abrir o painel de admin
              </Link>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="acesso">
        <h2 id="acesso">Acesso à conta</h2>
        <p>
          Passkeys associadas: {account.passkeys}.{' '}
          {account.chaves.some((c) => c.kind === 'prf')
            ? 'Num telemóvel novo com a mesma conta Google ou Apple, basta entrar com a passkey.'
            : 'Num dispositivo novo vai precisar do código de recuperação.'}
        </p>
        <div className="actions">
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run('passkey', async () => {
                await addPasskey();
                return { kind: 'ok', text: 'Passkey criada neste dispositivo.' };
              })
            }
          >
            Criar passkey neste dispositivo
          </button>
          {!newCode && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setNewCode(generateRecoveryCode())}
            >
              Novo código de recuperação
            </button>
          )}
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run('sair', async () => {
                await logout();
                onSignedOut();
              })
            }
          >
            Terminar sessão
          </button>
        </div>
        {newCode && (
          <>
            <RecoveryCodeBox
              code={newCode}
              confirmLabel="Usar este código novo"
              busy={busy === 'codigo'}
              onConfirm={() =>
                run('codigo', async () => {
                  await replaceRecoveryCode(newCode);
                  setNewCode(undefined);
                  return { kind: 'ok', text: 'Código novo guardado. O antigo deixou de servir.' };
                })
              }
            />
            <button type="button" onClick={() => setNewCode(undefined)}>
              Cancelar
            </button>
          </>
        )}
      </section>

      <details className="sources">
        <summary>Detalhes técnicos</summary>
        <p>
          Identificador da conta: <code>{account.id}</code>. Não identifica a pessoa: serve só para
          o suporte.
        </p>
      </details>

      <div className="danger-zone">
        {confirmDelete ? (
          <>
            <p>
              Apagar a conta e todas as cópias na nuvem? Os dados neste dispositivo ficam. Não é
              possível desfazer.
            </p>
            <div className="actions">
              <button
                type="button"
                className="danger"
                disabled={!!busy}
                onClick={() =>
                  run('apagar', async () => {
                    await deleteAccount();
                    onSignedOut();
                  })
                }
              >
                Sim, apagar tudo na nuvem
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                Não apagar
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}>
            Apagar a conta e as cópias na nuvem
          </button>
        )}
      </div>
    </>
  );
}

/** Que IA lê as cartas neste dispositivo e se há chave pessoal; tudo se gere em /cartas/ia. */
function AiSummary() {
  const settings = useLiveQuery(() => db.ia.get('ia'), [], null);
  if (settings === null) return null;
  const provider = settings?.fornecedor ?? 'workers-ai';
  const keys = [settings?.chave_gemini && 'Gemini', settings?.chave_claude && 'Claude'].filter(
    Boolean,
  );
  return (
    <section aria-labelledby="ia">
      <h2 id="ia">IA para ler cartas</h2>
      <p>
        Neste dispositivo: <strong>{PROVIDER_LABELS[provider]}</strong>.{' '}
        {keys.length
          ? `Chave pessoal guardada: ${keys.join(' e ')}.`
          : 'Sem chave pessoal guardada.'}
      </p>
      <p className="hint">
        As chaves pessoais ficam só neste dispositivo, cifradas: não vão para a conta nem para as
        cópias na nuvem. Noutro dispositivo, tem de as pôr outra vez.
      </p>
      <div className="actions">
        <Link to="/cartas/ia" className="button">
          Escolher a IA ou gerir a chave
        </Link>
      </div>
    </section>
  );
}

export default function CloudPage() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const title = account ? 'A minha conta' : 'Entrar ou criar conta';
  const heading = usePageHeading<HTMLHeadingElement>(title);
  const [error, setError] = useState<string>();

  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    currentAccount().then(
      (a) => {
        if (!alive) return;
        setAccount(a);
        setError(undefined);
      },
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [version]);

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <p className="lead">
        A conta é opcional: a app funciona sem ela. Serve para guardar uma cópia cifrada dos seus
        dados e para partilhar prazos com a família.
      </p>
      {error && <p className="errors">{error}</p>}
      {account === null && <SignedOut onSignedIn={refresh} />}
      {account && <SignedIn account={account} onChange={refresh} onSignedOut={refresh} />}
      {account === null && <AiSummary />}
      <LegalNotice />
    </>
  );
}
