import { isValidDate, todayInLisbon } from '@prazometro/engine';
import { useState } from 'react';

/** Pequeno formulário para guardar uma data até hoje (envio de uma carta, consulta feita...). */
export function DateRecorder({
  label,
  value,
  onSave,
}: {
  label: string;
  value?: string;
  onSave: (date: string) => void;
}) {
  const [date, setDate] = useState(value ?? todayInLisbon());
  const [error, setError] = useState('');
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValidDate(date) || date > todayInLisbon()) {
          setError('Escolha uma data até hoje.');
          return;
        }
        setError('');
        onSave(date);
      }}
    >
      <label className="field">
        {label}
        <input
          type="date"
          value={date}
          max={todayInLisbon()}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <button type="submit">Guardar a data</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
