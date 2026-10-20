import { useSyncExternalStore } from 'react';

// Instalação da PWA (mesma lógica do Poder e Beleza).
// O Chrome/Android dispara `beforeinstallprompt`, às vezes antes de o React montar, por isso o
// evento é apanhado ao carregar este módulo e guardado: o botão continua disponível mesmo depois
// de a notificação do navegador desaparecer. O Safari do iPhone não tem esse evento, só instruções.
// Num separador normal não se sabe se a app já está instalada (o Edge oferece sempre a instalação),
// por isso guarda-se a marca no aparelho e, onde existir, pergunta-se ao navegador.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALLED_KEY = 'prazometro.appInstalada';

function readInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeInstalled(value: boolean) {
  try {
    localStorage.setItem(INSTALLED_KEY, String(value));
  } catch {
    // Sem armazenamento: a marca vale só nesta sessão.
  }
}

let promptEvent: InstallPromptEvent | null = null;
let installed = readInstalled();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

function markInstalled() {
  installed = true;
  promptEvent = null;
  writeInstalled(true);
  notify();
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIphone(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** O Edge para Android só cria um atalho (com o símbolo do Edge); o Chrome instala uma app a sério. */
function isEdgeAndroid(): boolean {
  return /EdgA\//.test(navigator.userAgent);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  promptEvent = e as InstallPromptEvent;
  // O Chrome só oferece a instalação se a app não estiver instalada: se foi desinstalada, o
  // convite volta. O Edge oferece-a sempre, por isso aí não se pode concluir nada.
  if (!isEdgeAndroid() && installed) {
    installed = false;
    writeInstalled(false);
  }
  notify();
});
window.addEventListener('appinstalled', markInstalled);
if (isStandalone()) markInstalled();

// Chrome para Android: diz se a app deste site está instalada (manifest com related_applications).
// Só serve para confirmar: o Edge cria um atalho, não uma app, e responderia sempre "nenhuma".
(navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> })
  .getInstalledRelatedApps?.()
  .then((apps) => {
    if (apps.length > 0) markInstalled();
  })
  .catch(() => {});

export type InstallMode = 'button' | 'edge' | 'iphone' | null;

function currentMode(): InstallMode {
  if (installed || isStandalone()) return null;
  if (promptEvent) return isEdgeAndroid() ? 'edge' : 'button';
  return isIphone() ? 'iphone' : null;
}

function subscribe(f: () => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

export function useInstall(): { mode: InstallMode; install: () => Promise<void> } {
  const mode = useSyncExternalStore(subscribe, currentMode);
  return {
    mode,
    async install() {
      if (!promptEvent) return;
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') markInstalled();
      else {
        // O evento só pode ser usado uma vez; o Chrome volta a dispará-lo mais tarde.
        promptEvent = null;
        notify();
      }
    },
  };
}
