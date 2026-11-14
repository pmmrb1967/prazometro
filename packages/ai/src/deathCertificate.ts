import { findDates } from './dates';

// Preencher o início do processo pós-óbito a partir da certidão de óbito. A leitura é toda no
// dispositivo e sem IA: os campos têm rótulos fixos ("Nome", "Data do óbito", "Data do
// registo") e a certidão tem dados muito sensíveis, que não precisam de sair do telemóvel.
// Como na fatura, a leitura só propõe valores para a pessoa confirmar.

export type DeathCertificateReading = {
  /** Nome da pessoa que faleceu, como está na certidão (maiúsculas passam a nome próprio). */
  nome: string;
  /** Data do óbito (AAAA-MM-DD), vazia se não for encontrada. */
  data_obito: string;
  /** Data do registo (assento) do óbito (AAAA-MM-DD), vazia se não for encontrada. */
  data_registo_obito: string;
};

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Data na linha do rótulo ou, se o OCR partiu a linha, na seguinte. */
function dateAfterLabel(all: string[], label: RegExp, exclude?: RegExp): string {
  for (let i = 0; i < all.length; i++) {
    const line = all[i]!;
    if (!label.test(line) || exclude?.test(line)) continue;
    const after = line.slice(line.search(label));
    const here = findDates(after)[0];
    if (here) return here.data;
    const next = all[i + 1] && findDates(all[i + 1]!)[0];
    if (next) return next.data;
  }
  return '';
}

const PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** "MARIA DA CONCEIÇÃO SANTOS" → "Maria da Conceição Santos"; nomes já com minúsculas ficam. */
export function properName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean !== clean.toUpperCase()) return clean;
  return clean
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Rótulo do nome da pessoa falecida (não o dos pais, do cônjuge ou do declarante). */
const NAME_LABEL = /^nome(?:\s+completo)?(?!\s+d[aoe]s?\b)\s*[:.-]?\s*/i;

function nameOf(all: string[]): string {
  for (let i = 0; i < all.length; i++) {
    const m = NAME_LABEL.exec(all[i]!);
    if (!m) continue;
    // O nome acaba onde começar outro rótulo na mesma linha (por exemplo "Sexo:").
    const value = (all[i]!.slice(m[0].length) || all[i + 1] || '').split(/\s{2,}|\s\S+:/)[0]!;
    const letters = value.replace(/[^\p{L}\s'-]/gu, '').trim();
    if (letters.split(/\s+/).length >= 2) return properName(letters).slice(0, 120);
  }
  return '';
}

/** Leitura da certidão de óbito no dispositivo: nome, data do óbito e data do registo. */
export function readDeathCertificate(text: string): DeathCertificateReading {
  const all = lines(text);
  const data_obito =
    dateAfterLabel(all, /data\s+(?:do|de)\s+(?:[óo]bito|falecimento)/i) ||
    dateAfterLabel(all, /fal(?:eceu|ecimento)\s+(?:em|no\s+dia)/i);
  const data_registo_obito = dateAfterLabel(
    all,
    /data\s+(?:do|de)\s+(?:registo|assento)|assento\s+lavrado\s+em|registado\s+em/i,
  );
  return {
    nome: nameOf(all),
    data_obito,
    // O registo nunca é antes do óbito: se for, a leitura apanhou outra data.
    data_registo_obito:
      data_registo_obito && data_obito && data_registo_obito < data_obito ? '' : data_registo_obito,
  };
}
