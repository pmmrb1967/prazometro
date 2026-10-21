// O módulo pós-óbito não pode ser publicado sem revisão por um jurista (CLAUDE.md). Até lá,
// só abre em pré-visualização: em desenvolvimento ou depois de abrir uma vez
// /pos-obito?pre-visualizar neste dispositivo (fica guardado no navegador).

const KEY = 'prazometro-pre-visualizar-pos-obito';

export function previewEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    if (new URLSearchParams(location.search).has('pre-visualizar')) localStorage.setItem(KEY, '1');
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function disablePreview() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sem armazenamento: a pré-visualização já não fica guardada.
  }
}
