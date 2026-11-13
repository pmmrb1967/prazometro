import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

// Atualizações da app (mesma lógica do Validómetro e do Faturómetro). Recarregar sozinho podia
// apagar o que a pessoa está a escrever, por isso uma versão nova nunca se aplica sozinha: uma
// barra no topo avisa e um toque recarrega.

/** Uma app instalada que volta do segundo plano não recarrega: procura versões novas de vez em quando. */
const CHECK_MINUTES = 60;

let needRefresh = false;
const listeners = new Set<() => void>();
let updateServiceWorker: ((reload?: boolean) => Promise<void>) | undefined;

export function registerPwa(): void {
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      listeners.forEach((f) => f());
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => undefined);
      window.setInterval(check, CHECK_MINUTES * 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => needRefresh,
  );
}

export function applyUpdate(): void {
  // Na primeira visita a página ainda não é controlada pelo service worker, que por isso não
  // a recarrega sozinho: recarregar já traz a versão nova do servidor.
  if (!navigator.serviceWorker?.controller) {
    window.location.reload();
    return;
  }
  void updateServiceWorker?.(true);
}
