// Pedidos à API do Prazómetro (mesmo domínio). A sessão vai num cookie HttpOnly.

import { markSignedIn } from './session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; json?: unknown; body?: BodyInit } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'x-prazometro': '1' };
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (body !== undefined ? 'POST' : 'GET'),
      headers,
      body,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Sem ligação à internet. Tente outra vez quando tiver rede.');
  }
  if (!res.ok) {
    // Sessão terminada ou inexistente: a barra de topo volta a mostrar "Entrar".
    if (res.status === 401) markSignedIn(false);
    const data = (await res.json().catch(() => null)) as { erro?: string } | null;
    throw new ApiError(res.status, data?.erro ?? 'Ocorreu um erro. Tente outra vez.');
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.arrayBuffer()) as Promise<T>;
}
