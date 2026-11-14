import { formatDateShort } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Choice } from '../components/Choice';
import { api } from '../cloud/api';
import { currentAccount } from '../cloud/cloud';
import { db, type SentShare, type ShareScope } from '../db';
import { Link, usePageHeading } from '../router';
import { inviteLink, ShareTooLargeError } from './shareCrypto';
import { createShare, pushShare, revokeShare, SCOPE_LABELS } from './shares';
import {
  inviteText,
  isComputer,
  openWhatsapp,
  saveDesktopChoice,
  savedDesktopChoice,
  type WhatsAppDesktop,
} from './whatsapp';

const link = (s: SentShare) => inviteLink(location.origin, s.id, s.chave);

export default function SharePage() {
  const heading = usePageHeading<HTMLHeadingElement>('Partilhar com a família');
  const [account, setAccount] = useState<boolean | null>(null);
  const sent = useLiveQuery(() => db.partilhas_enviadas.orderBy('criado_em').toArray());
  const [created, setCreated] = useState<SentShare>();

  useEffect(() => {
    currentAccount()
      .then((a) => setAccount(!!a))
      .catch(() => setAccount(false));
  }, []);

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Partilhar com a família
      </h1>
      <p className="lead">
        Um filho, uma filha ou outra pessoa de confiança pode acompanhar os seus prazos no telemóvel
        dela. Só vê o tema que escolher e não consegue alterar nada.
      </p>
      <div className="notice" role="note">
        <p>
          A app cria uma ligação com uma chave secreta. Os dados saem do seu telemóvel já cifrados e
          o servidor não os consegue ler.{' '}
          <strong>Quem tiver a ligação consegue ver os dados</strong>: envie-a só a quem confia.
        </p>
      </div>

      {account === null ? (
        <p>A verificar a sua conta…</p>
      ) : account ? (
        created ? (
          <Created share={created} onDone={() => setCreated(undefined)} />
        ) : (
          <NewShare onCreated={setCreated} />
        )
      ) : (
        <section aria-labelledby="sem-conta">
          <h2 id="sem-conta">Precisa de uma conta</h2>
          <p>
            Para partilhar, a app precisa de guardar os dados cifrados no servidor. Crie uma conta
            ou entre na sua. Quem recebe não precisa de conta.
          </p>
          <Link to="/conta" className="button primary">
            Entrar ou criar conta
          </Link>
        </section>
      )}

      {account && sent && <Orphans known={sent.map((s) => s.id)} />}

      {sent && sent.length > 0 && (
        <section aria-labelledby="enviadas">
          <h2 id="enviadas">As suas partilhas</h2>
          <ul className="cards">
            {sent.map((s) => (
              <SentCard key={s.id} share={s} />
            ))}
          </ul>
        </section>
      )}

      <p>
        <Link to="/partilhas">Partilhas que recebeu</Link>
      </p>
    </>
  );
}

type ServerShare = { id: string; scope: ShareScope; updated_at: number };

/** Partilhas da conta criadas noutro telemóvel (aqui não há a chave): só se podem retirar. */
function Orphans({ known }: { known: string[] }) {
  const [list, setList] = useState<ServerShare[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    api<{ partilhas: ServerShare[] }>('/shares')
      .then((r) => setList(r.partilhas))
      .catch(() => undefined);
  }, []);
  const orphans = list.filter((s) => !known.includes(s.id));
  if (orphans.length === 0) return null;
  return (
    <section aria-labelledby="outras">
      <h2 id="outras">Partilhas criadas noutro telemóvel</h2>
      <p>
        Estas partilhas foram criadas noutro dispositivo. Daqui não é possível atualizá-las nem
        copiar a ligação, mas pode retirar o acesso.
      </p>
      <ul className="cards">
        {orphans.map((s) => (
          <li key={s.id}>
            <p>
              <strong>{SCOPE_LABELS[s.scope]}</strong>
              <br />
              <span className="muted">
                Atualizada a{' '}
                {formatDateShort(new Date(s.updated_at * 1000).toISOString().slice(0, 10))}
              </span>
            </p>
            <div className="actions">
              <button
                type="button"
                onClick={() =>
                  revokeShare(s.id)
                    .then(() => setList((l) => l.filter((x) => x.id !== s.id)))
                    .catch((e: Error) => setError(e.message))
                }
              >
                Retirar o acesso
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function NewShare({ onCreated }: { onCreated: (s: SentShare) => void }) {
  const scopes = Object.entries(SCOPE_LABELS) as [ShareScope, string][];
  const [scope, setScope] = useState<ShareScope>('garantia');
  const [de, setDe] = useState('');
  const [para, setPara] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onCreated(await createShare(scope, de.trim() || undefined, para.trim() || undefined));
    } catch (err) {
      setError(
        err instanceof ShareTooLargeError
          ? 'Há demasiados dados neste tema para partilhar.'
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <h2>Nova partilha</h2>
      <Choice
        legend="O que quer partilhar?"
        name="ambito"
        value={scope}
        options={scopes}
        onChange={setScope}
      />
      <label className="field">
        <span>
          O seu nome <span className="optional">(opcional, para quem recebe saber de quem é)</span>
        </span>
        <input value={de} onChange={(e) => setDe(e.target.value)} autoComplete="name" />
      </label>
      <label className="field">
        <span>
          Para quem <span className="optional">(opcional, só fica neste telemóvel)</span>
        </span>
        <input value={para} onChange={(e) => setPara(e.target.value)} />
      </label>
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'A cifrar e a enviar…' : 'Criar a ligação'}
        </button>
      </div>
    </form>
  );
}

/** "Enviar por WhatsApp": no computador, pergunta uma vez se abre a app ou o WhatsApp Web. */
function WhatsAppButton({ text }: { text: string }) {
  const [asking, setAsking] = useState(false);
  const [openedOnComputer, setOpenedOnComputer] = useState(false);

  function send() {
    if (!isComputer()) return openWhatsapp('mobile', text);
    const saved = savedDesktopChoice();
    if (!saved) return setAsking(true);
    openWhatsapp(saved, text);
    setOpenedOnComputer(true);
  }

  function choose(choice: WhatsAppDesktop) {
    saveDesktopChoice(choice);
    setAsking(false);
    openWhatsapp(choice, text);
    setOpenedOnComputer(true);
  }

  return (
    <>
      <button type="button" onClick={send}>
        Enviar por WhatsApp
      </button>
      {asking && (
        <div className="notice whatsapp-choice" role="group" aria-label="Como abrir o WhatsApp">
          <p>Como quer abrir o WhatsApp neste computador?</p>
          <div className="actions">
            <button type="button" onClick={() => choose('app')}>
              Na app do WhatsApp
            </button>
            <button type="button" onClick={() => choose('web')}>
              No WhatsApp Web
            </button>
          </div>
        </div>
      )}
      {openedOnComputer && !asking && (
        <button
          type="button"
          className="link-button whatsapp-choice"
          onClick={() => setAsking(true)}
        >
          Não abriu? Escolher outra forma
        </button>
      )}
    </>
  );
}

function CopyOrSend({ share }: { share: SentShare }) {
  const [copied, setCopied] = useState(false);
  const url = link(share);
  return (
    <div className="actions">
      <WhatsAppButton text={inviteText(share.ambito, url)} />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? 'Ligação copiada' : 'Copiar a ligação'}
      </button>
      {'share' in navigator && (
        <button
          type="button"
          onClick={() =>
            navigator
              .share({ title: 'Prazómetro', text: `Partilha: ${SCOPE_LABELS[share.ambito]}`, url })
              .catch(() => undefined)
          }
        >
          Enviar por mensagem
        </button>
      )}
    </div>
  );
}

function Created({ share, onDone }: { share: SentShare; onDone: () => void }) {
  return (
    <section aria-labelledby="criada" className="form">
      <h2 id="criada">Ligação criada</h2>
      <p>
        Envie esta ligação a {share.para || 'quem vai acompanhar'}. Ao abri-la, a pessoa vê o tema{' '}
        <strong>{SCOPE_LABELS[share.ambito]}</strong> no telemóvel dela.
      </p>
      <p className="share-link">{link(share)}</p>
      <CopyOrSend share={share} />
      <p className="hint">Sempre que abrir a app e houver alterações, a partilha é atualizada.</p>
      <div className="actions">
        <button type="button" onClick={onDone}>
          Concluído
        </button>
      </div>
    </section>
  );
}

function SentCard({ share: s }: { share: SentShare }) {
  const [confirm, setConfirm] = useState(false);
  // As formas de enviar a ligação só aparecem a pedido: no cartão ficam três botões numa linha.
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  async function run(action: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setMsg(undefined);
    try {
      await action();
      if (ok) setMsg({ ok: true, text: ok });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <p>
        <strong>{SCOPE_LABELS[s.ambito]}</strong>
        {s.para && ` · para ${s.para}`}
        <br />
        <span className="muted">
          {s.enviada_em
            ? `Atualizada a ${formatDateShort(s.enviada_em.slice(0, 10))}`
            : 'Ainda não enviada'}
        </span>
      </p>
      <div className="actions">
        <button type="button" aria-expanded={sending} onClick={() => setSending((v) => !v)}>
          Enviar a ligação
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => pushShare(s, true), 'Partilha atualizada.')}
        >
          Atualizar agora
        </button>
        {confirm ? (
          <>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => run(() => revokeShare(s.id))}
            >
              Sim, retirar o acesso
            </button>
            <button type="button" onClick={() => setConfirm(false)}>
              Não
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirm(true)}>
            Retirar o acesso
          </button>
        )}
      </div>
      {sending && <CopyOrSend share={s} />}
      {confirm && (
        <p className="hint">
          A ligação deixa de funcionar e os dados desaparecem do telemóvel da outra pessoa quando
          ela abrir a app. Não é possível apagar cópias que ela tenha feito por outros meios.
        </p>
      )}
      {msg && (
        <p className={msg.ok ? 'ok' : 'errors'} role="status">
          {msg.text}
        </p>
      )}
    </li>
  );
}
