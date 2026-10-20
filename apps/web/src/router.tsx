import { useEffect, useRef, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';

// Navegação simples por caminhos (/garantia/123). O Worker devolve a app em qualquer caminho
// (single-page-application), por isso as ligações funcionam também quando abertas diretamente.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
window.addEventListener('popstate', notify);

function subscribe(f: () => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  notify();
  window.scrollTo(0, 0);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

/** "/garantia/:id" contra "/garantia/abc" → { id: "abc" }; null se não corresponder. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i]!.startsWith(':')) params[p[i]!.slice(1)] = decodeURIComponent(s[i]!);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

type LinkProps = { to: string; className?: string; children: ReactNode };

export function Link({ to, className, children }: LinkProps) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  }
  return (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

/** Título do separador e foco no h1 ao mudar de página (para leitores de ecrã). */
export function usePageHeading<T extends HTMLElement>(title: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    document.title = `${title} · Prazómetro`;
    ref.current?.focus();
  }, [title]);
  return ref;
}
