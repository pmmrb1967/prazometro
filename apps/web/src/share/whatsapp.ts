// Abrir o WhatsApp com a mensagem já escrita (mesma lógica do Poder e Beleza), sem número:
// a pessoa escolhe o familiar na lista do WhatsApp e carrega em "Enviar".
// No telemóvel, wa.me abre logo a app. No computador, wa.me mostra uma página intermédia
// (o navegador não sabe se a app está instalada), por isso a pessoa escolhe uma vez entre a app
// e o WhatsApp Web, e a escolha fica guardada neste dispositivo.

import type { ShareScope } from '../db';
import { SCOPE_LABELS } from './shares';

export type WhatsAppDesktop = 'app' | 'web';

const KEY = 'prazometro.whatsappPc';

export function isComputer(): boolean {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  // O iPad em modo "computador" diz que é um Mac, mas tem ecrã tátil.
  return !mobile && navigator.maxTouchPoints <= 1;
}

export function savedDesktopChoice(): WhatsAppDesktop | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'app' || v === 'web' ? v : null;
  } catch {
    return null;
  }
}

export function saveDesktopChoice(choice: WhatsAppDesktop) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Sem armazenamento: pergunta outra vez da próxima.
  }
}

/** Endereço que abre o WhatsApp com o texto escrito, para o telemóvel ou para o computador. */
export function whatsappUrl(mode: WhatsAppDesktop | 'mobile', text: string): string {
  const t = encodeURIComponent(text);
  if (mode === 'app') return `whatsapp://send?text=${t}`;
  if (mode === 'web') return `https://web.whatsapp.com/send?text=${t}`;
  return `https://wa.me/?text=${t}`;
}

export function openWhatsapp(mode: WhatsAppDesktop | 'mobile', text: string) {
  const url = whatsappUrl(mode, text);
  if (mode === 'app') {
    window.location.href = url;
    return;
  }
  const w = window.open(url, '_blank');
  if (w) w.opener = null;
  else window.location.href = url;
}

/** Texto da mensagem de convite, com a ligação (a chave vai depois do #, nunca no servidor). */
export function inviteText(scope: ShareScope, url: string): string {
  return `Partilho consigo os meus prazos do Prazómetro: ${SCOPE_LABELS[scope]}. Abra esta ligação no telemóvel para os acompanhar:
${url}`;
}
