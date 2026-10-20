import type { ReactNode } from 'react';

type ChoiceProps<T extends string> = {
  legend: string;
  hint?: ReactNode;
  name: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
};

/** Pergunta com respostas em botões de opção, grandes e fáceis de tocar. */
export function Choice<T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
}: ChoiceProps<T>) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      {hint && <p className="hint">{hint}</p>}
      {options.map(([v, label]) => (
        <label key={v}>
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
