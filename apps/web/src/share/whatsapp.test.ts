import { describe, expect, it } from 'vitest';
import { inviteText, whatsappUrl } from './whatsapp';

describe('enviar o convite por WhatsApp', () => {
  const url = 'https://app.prazometro.workers.dev/partilha#id=abc&k=chave+/=';

  it('o texto leva o tema e a ligação completa, com a chave depois do #', () => {
    const text = inviteText('sns', url);
    expect(text).toContain('Prazómetro: Espera no SNS.');
    expect(text.endsWith(url)).toBe(true);
  });

  it('cifra o texto no endereço, para o # e a chave não se perderem', () => {
    const text = inviteText('garantia', url);
    for (const mode of ['mobile', 'app', 'web'] as const) {
      const u = whatsappUrl(mode, text);
      expect(u).not.toContain('#');
      expect(decodeURIComponent(u.split('text=')[1]!)).toBe(text);
    }
    expect(whatsappUrl('mobile', text)).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(whatsappUrl('app', text)).toMatch(/^whatsapp:\/\/send\?text=/);
    expect(whatsappUrl('web', text)).toMatch(/^https:\/\/web\.whatsapp\.com\/send\?text=/);
  });
});
