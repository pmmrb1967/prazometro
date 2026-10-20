import { useEffect, useState } from 'react';

// Fase 0: preferências em localStorage. Passam para a tabela `config` (Dexie) quando existir.
export const FONT_SCALES = [1, 1.2, 1.4] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export type Preferences = { fontScale: FontScale; highContrast: boolean };

const KEY = 'prazometro.preferences';
const DEFAULTS: Preferences = { fontScale: 1, highContrast: false };

function load(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      fontScale: FONT_SCALES.includes(parsed.fontScale as FontScale)
        ? (parsed.fontScale as FontScale)
        : DEFAULTS.fontScale,
      highContrast: parsed.highContrast === true,
    };
  } catch {
    return DEFAULTS;
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-scale', String(prefs.fontScale));
    root.dataset.contrast = prefs.highContrast ? 'alto' : 'normal';
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Sem armazenamento (modo privado): as preferências valem só nesta sessão.
    }
  }, [prefs]);

  return [prefs, setPrefs] as const;
}
