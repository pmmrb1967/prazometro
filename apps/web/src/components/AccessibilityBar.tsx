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
            style={{ fontSize: `${0.9 + i * 0.25}em` }}
          >
            A<span className="sr-only"> Letra {SCALE_LABELS[i]}</span>
          </button>
        ))}
      </fieldset>
      <button
        type="button"
        className="a11y-contrast"
        aria-pressed={prefs.highContrast}
        onClick={() => onChange({ ...prefs, highContrast: !prefs.highContrast })}
      >
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18z" className="icon-fill" />
        </svg>
        <span className="label-long">Alto contraste</span>
        <span className="label-short">Contraste</span>
      </button>
    </div>
  );
}
