import { FONT_SCALES, type Preferences } from '../preferences';

type Props = {
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
};

const SCALE_LABELS = ['normal', 'grande', 'muito grande'];

export function AccessibilityBar({ prefs, onChange }: Props) {
  return (
    <div className="a11y">
      <fieldset className="a11y-sizes">
        <legend className="sr-only">Tamanho da letra</legend>
        {FONT_SCALES.map((scale, i) => (
          <button
            key={scale}
            type="button"
            aria-pressed={prefs.fontScale === scale}
            onClick={() => onChange({ ...prefs, fontScale: scale })}
            style={{ fontSize: `${0.9 + i * 0.25}rem` }}
          >
            A<span className="sr-only"> Letra {SCALE_LABELS[i]}</span>
          </button>
        ))}
      </fieldset>
      <button
        type="button"
        aria-pressed={prefs.highContrast}
        onClick={() => onChange({ ...prefs, highContrast: !prefs.highContrast })}
      >
        Alto contraste
      </button>
    </div>
  );
}
