import { useInstall } from '../install';

function ShareIcon() {
  return (
    <svg
      className="share-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** Convite para instalar a app. Não aparece se já estiver instalada ou se o navegador não deixar. */
export function InstallPrompt() {
  const { mode, install } = useInstall();
  if (!mode) return null;

  return (
    <section className="install" aria-labelledby="install-title">
      <img src="/logo.svg" alt="" width="48" height="48" />
      <div className="install-text">
        <h2 id="install-title">Tenha o Prazómetro no telemóvel</h2>
        {mode === 'button' && <p>Abre como uma app, com um toque, e funciona mesmo sem rede.</p>}
        {mode === 'edge' && (
          <p>
            Para a app ficar como as outras (sem o símbolo do Edge e na lista de apps), abra este
            endereço no Chrome e instale-a de lá.
          </p>
        )}
        {mode === 'iphone' && (
          <p>
            No Safari, toque em <ShareIcon />
            <span className="sr-only">Partilhar</span> e depois em “Adicionar ao ecrã principal”.
          </p>
        )}
      </div>
      {mode !== 'iphone' && (
        <button
          type="button"
          className={mode === 'button' ? 'primary' : undefined}
          onClick={install}
        >
          {mode === 'edge' ? 'Instalar no Edge' : 'Instalar'}
        </button>
      )}
    </section>
  );
}
