import { addDays, type IsoDate } from './date';

// Exportação de lembretes para o calendário (RFC 5545), sem servidor de notificações.
// Cada prazo é um evento de dia inteiro. Os alarmes tocam às 09:00 (hora do dispositivo):
// para um evento de dia inteiro, o TRIGGER é relativo às 00:00 do próprio dia.

export type CalendarEvent = {
  uid: string;
  data: IsoDate;
  titulo: string;
  descricao?: string;
  /** Dias antes do evento em que o calendário avisa (0 = no próprio dia). */
  alarmes_dias_antes?: number[];
};

export type IcsOptions = { nome?: string; agora?: Date };

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function utf8Length(ch: string): number {
  const cp = ch.codePointAt(0)!;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/** Dobra linhas com mais de 75 octetos (UTF-8) sem partir caracteres. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8Length(ch);
    const limit = parts.length === 0 ? 75 : 74; // as linhas de continuação começam com espaço
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function compactDate(date: IsoDate): string {
  return date.replace(/-/g, '');
}

function timestamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function trigger(daysBefore: number): string {
  if (daysBefore === 0) return 'PT9H';
  // 09:00 do dia N dias antes = (N - 1) dias e 15 horas antes da meia-noite do evento.
  return daysBefore === 1 ? '-PT15H' : `-P${daysBefore - 1}DT15H`;
}

export function buildIcs(events: CalendarEvent[], options: IcsOptions = {}): string {
  const stamp = timestamp(options.agora ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prazómetro//Prazómetro//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.nome ?? 'Prazómetro')}`,
  ];

  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@prazometro`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(e.data)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(e.data, 1))}`,
      `SUMMARY:${escapeText(e.titulo)}`,
    );
    if (e.descricao) lines.push(`DESCRIPTION:${escapeText(e.descricao)}`);
    lines.push('TRANSP:TRANSPARENT');
    for (const n of [...new Set(e.alarmes_dias_antes ?? [])].sort((a, b) => b - a)) {
      if (!Number.isInteger(n) || n < 0) throw new RangeError(`Alarme inválido: ${n} dias antes`);
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.titulo)}`,
        `TRIGGER:${trigger(n)}`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');

  return lines.map(fold).join('\r\n') + '\r\n';
}
