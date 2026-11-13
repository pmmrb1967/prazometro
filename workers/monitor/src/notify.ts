import { METRICS } from './limits';
import type { Alert } from './monitor';

// Envio dos alertas ao admin por WhatsApp, com o CallMeBot (gratuito para uso pessoal: só envia
// para o número de quem o ativou). Ativação: https://www.callmebot.com/blog/free-api-whatsapp-messages/
// A mensagem leva só números agregados do plano gratuito, nunca dados de utilizadores.

export type WhatsAppConfig = { phone: string; apikey: string };

const API = 'https://api.callmebot.com/whatsapp.php';
const MB = 1024 * 1024;

function formatValue(metric: Alert['metric'], value: number): string {
  if (metric !== 'monitor' && METRICS[metric].unidade === 'bytes') {
    return `${(value / MB).toFixed(1).replace('.', ',')} MB`;
  }
  return value.toLocaleString('pt-PT');
}

/** Texto da mensagem: uma linha por alerta novo e, se for o caso, o modo poupança. */
export function alertMessage(date: string, alerts: Alert[], savingsOn: boolean): string {
  const lines = [`*Prazómetro: alertas de ${date}*`];
  for (const a of alerts) {
    if (a.metric === 'monitor') {
      lines.push('- Não foi possível ler as estatísticas da Cloudflare (confirme o token).');
      continue;
    }
    const info = METRICS[a.metric];
    lines.push(
      `- ${info.rotulo}: ${a.threshold}% do limite (${formatValue(a.metric, a.value)} de ${formatValue(a.metric, info.limite!)}).`,
    );
  }
  if (savingsOn) {
    lines.push('Modo poupança ligado até às 00:00 UTC: IA do admin e cópias suspensas.');
  }
  lines.push('Painel: https://app.prazometro.workers.dev/admin');
  return lines.join('\n');
}

/** Envia a mensagem. Os erros não mostram o número nem a chave. */
export async function sendWhatsApp(
  config: WhatsAppConfig,
  text: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const url = new URL(API);
  url.searchParams.set('phone', config.phone);
  url.searchParams.set('text', text);
  url.searchParams.set('apikey', config.apikey);
  let res: Response;
  try {
    res = await fetchFn(url.toString(), { signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error('WhatsApp: sem resposta do CallMeBot');
  }
  const body = await res.text().catch(() => '');
  // O CallMeBot responde 200 mesmo com alguns erros (por exemplo, chave errada) e explica no texto.
  if (!res.ok || /invalid|not activated/i.test(body)) {
    throw new Error(`WhatsApp: o CallMeBot recusou o envio (HTTP ${res.status})`);
  }
}
