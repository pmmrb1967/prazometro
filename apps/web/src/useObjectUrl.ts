import { useEffect, useMemo } from 'react';

const pendingRevoke = new Map<string, ReturnType<typeof setTimeout>>();

/** Endereço temporário (blob:) para mostrar um ficheiro guardado no dispositivo. */
export function useObjectUrl(blob?: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => {
    if (!url) return;
    // O React (StrictMode) pode desmontar e voltar a montar o efeito com o mesmo endereço: a
    // revogação espera um pouco e é cancelada se o endereço voltar a ser usado.
    clearTimeout(pendingRevoke.get(url));
    pendingRevoke.delete(url);
    return () => {
      pendingRevoke.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url);
          pendingRevoke.delete(url);
        }, 1000),
      );
    };
  }, [url]);
  return url;
}
