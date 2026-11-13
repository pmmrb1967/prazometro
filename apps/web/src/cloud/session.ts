import { useSyncExternalStore } from 'react';

// Marca local "este dispositivo tem sessão aberta", só para a barra de topo mostrar
// "A minha conta" em vez de "Entrar" sem perguntar ao servidor em cada página.
// Não dá acesso a nada: quem decide é sempre o cookie de sessão no servidor.

const KEY = 'prazometro.sessao';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let signedIn = read();
const listeners = new Set<() => void>();

export function markSignedIn(value: boolean) {
  if (value === signedIn) return;
  signedIn = value;
  try {
    if (value) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Sem armazenamento: a marca vale só enquanto a página estiver aberta.
  }
  listeners.forEach((f) => f());
}

export function useSignedIn(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => signedIn,
  );
}
