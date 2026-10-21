import { DATE_PATTERN } from './dates';

// Anonimização antes de qualquer envio para uma IA (CLAUDE.md, secção IA).
// Corre no dispositivo e outra vez no Worker. Troca por marcadores ([NIF], [NOME], ...):
// NIF, NISS, IBAN, telefones, emails, matrículas, números de processo e referências,
// moradas, códigos postais e nomes. Na dúvida, apaga a mais: um número a menos não
// estraga o resumo, um dado pessoal a mais não pode sair.

export type Kind =
  | 'NIF'
  | 'NISS'
  | 'IBAN'
  | 'TELEFONE'
  | 'EMAIL'
  | 'MATRÍCULA'
  | 'PROCESSO'
  | 'REFERÊNCIA'
  | 'NÚMERO'
  | 'MORADA'
  | 'CÓDIGO POSTAL'
  | 'NOME';

export type Anonymized = { texto: string; contagem: Partial<Record<Kind, number>> };

export type AnonymizeOptions = {
  /** Nomes que a pessoa já indicou (por exemplo, no perfil das cartas). */
  nomes?: string[];
};

/** NIF português: 9 dígitos com dígito de controlo (módulo 11). */
export function isNif(digits: string): boolean {
  if (!/^[1235689]\d{8}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += +digits[i]! * (9 - i);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === +digits[8]!;
}

const UPPER = 'A-ZÀ-ÖØ-Ý';
const LOWER = 'a-zß-öø-ÿ';
const WORD = `(?:[${UPPER}][${LOWER}'’]+|[${UPPER}]{2,})`;
const CONNECTOR = '(?:d[aeo]s?|D[AEO]S?|e|E)';
const NAME = `${WORD}(?:[ \\t]+(?:${CONNECTOR}[ \\t]+)?${WORD}){0,6}`;

/** Palavras que aparecem depois de "Caro" ou "Nome:" e não são nomes. */
const NOT_NAMES = new Set(
  [
    'cliente',
    'clientes',
    'contribuinte',
    'senhor',
    'senhora',
    'utente',
    'arguido',
    'arguida',
    'requerente',
    'titular',
    'destinatário',
    'associado',
    'associada',
    'segurado',
    'segurada',
    'exmo',
    'exma',
  ].map((w) => w.toLowerCase()),
);

const LABELS = [
  String.raw`Exm[oa]s?\.?(?:\(a\))?[ \t]+(?:Senhor(?:\(a\)|a)?|Sr(?:a|\.ª|ª)?\.?(?:\(a\))?)`,
  String.raw`Prezad[oa](?:\(a\))?(?:[ \t]+(?:Senhor(?:\(a\)|a)?|Sr(?:a|\.ª|ª)?\.?))?`,
  String.raw`Car[oa](?:\(a\))?`,
  String.raw`(?:Sr|Sra|Dr|Dra|Eng)\.ª?`,
  String.raw`(?:Senhor|Senhora|D\.)`,
  String.raw`(?:Nome|NOME|Destinatário|DESTINATÁRIO|Arguid[oa]|ARGUID[OA]|Executad[oa]|EXECUTAD[OA]|Contribuinte|CONTRIBUINTE|Titular|TITULAR|Réu|Ré|RÉU|Requerid[oa]|Utente|UTENTE|Devedor(?:a)?|DEVEDOR)(?:[ \t]+(?:do|da)[ \t]+[${LOWER}]+)?[ \t]*:`,
];
// O nome pode vir na mesma linha ou na linha seguinte ("Exma. Senhora\nAna Carvalho").
const LABELLED_NAME = new RegExp(`(${LABELS.join('|')})([ \\t]+|[ \\t]*\\n[ \\t]*)(${NAME})`, 'gu');

const STREET = [
  'Rua',
  'R\\.',
  'Avenida',
  'Av\\.',
  'Travessa',
  'Tv\\.',
  'Largo',
  'Praça',
  'Praceta',
  'Estrada',
  'Alameda',
  'Calçada',
  'Beco',
  'Bairro',
  'Urbanização',
  'Urb\\.',
  'Quinta',
  'Lugar',
  'Caminho',
  'Rotunda',
  'Edifício',
];
const STREET_ALL = [...STREET, ...STREET.map((s) => s.toUpperCase())];
const ADDRESS = new RegExp(`\\b(?:${STREET_ALL.join('|')})[ \\t][^\\n]{0,100}`, 'gu');

const POSTAL = new RegExp(
  `\\b\\d{4}-\\d{3}(?:[ \\t]+[${UPPER}][\\p{L}'’-]*(?:[ \\t]+(?:d[aeo]s?|[${UPPER}][\\p{L}'’-]*))*)?`,
  'gu',
);

const REFERENCE = new RegExp(
  String.raw`\b((?:[Pp]rocesso|PROCESSO|[Pp]roc\.|[Aa]uto|AUTO|[Rr]eferência|REFERÊNCIA|[Rr]ef\.|[Cc]ontrato|CONTRATO|[Cc]liente|CLIENTE|[Cc]onta|CONTA|[Aa]pólice|[Dd]ocumento|DOCUMENTO|[Ff]atura|FATURA|[Nn]ota de cobrança|[Ll]icença|[Cc]ertidão|[Ii]nstalação|CPE|CIL|[Cc]artão de [Cc]idadão)(?:[ \t]+(?:n\.?[ \t]?[ºo°]\.?|número|nr\.?|N\.?º))?[ \t]*[:-]?[ \t]*)([A-Z0-9][A-Z0-9/.\-]{3,}[A-Z0-9])`,
  'gu',
);
const COURT_CASE = /\b\d{1,7}\/\d{2,4}\.\d{0,2}[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*\b/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PLATE =
  /\b(?:[A-Z]{2}[- ·]\d{2}[- ·](?:\d{2}|[A-Z]{2})|\d{2}[- ·][A-Z]{2}[- ·]\d{2}|\d{2}[- ·]\d{2}[- ·][A-Z]{2})\b/g;
const LONG_NUMBER = /(?<![\w/])(?:\+\s?)?\d(?:[ .]?\d){6,}(?![\w/])/g;
/** Montantes ("1.234,56 €") e referências legais ("Lei n.º 7/2009", "artigo 175.º"): protegidos. */
const AMOUNT = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b/g;
const LAW =
  /\b(?:Lei|Decreto-Lei|DL|Portaria|Despacho|Regulamento|Decreto Regulamentar)(?:[ \t]+n\.?[ \t]?º)?[ \t]*\d+(?:[-/][\dA-Z]+)*(?:\/\d+)?/g;

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function anonymize(text: string, options: AnonymizeOptions = {}): Anonymized {
  const contagem: Partial<Record<Kind, number>> = {};
  const count = (k: Kind) => (contagem[k] = (contagem[k] ?? 0) + 1);
  const mark = (k: Kind) => {
    count(k);
    return `[${k}]`;
  };

  // 1. Proteger datas, montantes e referências legais (são precisos para o resumo).
  const kept: string[] = [];
  const protect = (m: string) => `\uE000${kept.push(m) - 1}\uE000`;
  let t = text
    .replace(LAW, protect)
    .replace(new RegExp(DATE_PATTERN.source, 'gi'), protect)
    .replace(AMOUNT, protect);

  // 2. Identificadores com formato próprio.
  t = t
    .replace(EMAIL, () => mark('EMAIL'))
    .replace(IBAN, () => mark('IBAN'))
    .replace(COURT_CASE, () => mark('PROCESSO'))
    .replace(REFERENCE, (_m, label: string, code: string) =>
      /\d/.test(code) ? `${label}${mark('REFERÊNCIA')}` : `${label}${code}`,
    )
    .replace(PLATE, () => mark('MATRÍCULA'))
    .replace(LONG_NUMBER, (m) => {
      const digits = m.replace(/\D/g, '').replace(/^351(?=\d{9}$)/, '');
      if (digits.length === 9 && isNif(digits)) return mark('NIF');
      if (digits.length === 11 && /^[12]/.test(digits)) return mark('NISS');
      if (digits.length === 9 && /^[29]/.test(digits)) return mark('TELEFONE');
      return mark('NÚMERO');
    });

  // 3. Moradas e códigos postais.
  t = t.replace(ADDRESS, () => mark('MORADA')).replace(POSTAL, () => mark('CÓDIGO POSTAL'));

  // 4. Nomes: depois de "Exmo. Senhor", "Nome:", etc., os indicados pela pessoa e os mesmos
  //    nomes noutros sítios da carta.
  const found = new Set<string>();
  for (const n of options.nomes ?? []) {
    for (const w of n.split(/\s+/)) if (w.length >= 3) found.add(w);
  }
  t = t.replace(LABELLED_NAME, (m, label: string, space: string, name: string) => {
    const words = name.split(/[ \t]+/).filter((w) => !/^(?:d[aeo]s?|e)$/i.test(w));
    if (words.every((w) => NOT_NAMES.has(w.toLowerCase()))) return m;
    for (const w of words) if (w.length >= 3 && !NOT_NAMES.has(w.toLowerCase())) found.add(w);
    return `${label}${space}${mark('NOME')}`;
  });
  // Linha só com um nome, logo acima de uma morada (bloco do destinatário).
  t = t.replace(
    new RegExp(`^([ \\t]*)(${NAME})[ \\t]*\\n(?=[ \\t]*\\[MORADA\\])`, 'gmu'),
    (_m, indent: string, name: string) => {
      for (const w of name.split(/[ \t]+/)) if (w.length >= 3) found.add(w);
      return `${indent}${mark('NOME')}\n`;
    },
  );
  if (found.size) {
    const words = [...found].sort((a, b) => b.length - a.length).map(escape);
    const any = new RegExp(
      `(?<![\\p{L}])(?:${words.join('|')})(?:[ \\t]+(?:${CONNECTOR}[ \\t]+)?(?:${words.join('|')}))*(?![\\p{L}])`,
      'giu',
    );
    t = t.replace(any, () => mark('NOME'));
  }

  // 5. Repor o que foi protegido.
  t = t.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => kept[+i]!);
  return { texto: t, contagem };
}

/** "3 nomes, 1 NIF e 2 moradas" para mostrar à pessoa o que foi apagado. */
export function describeRemoved(contagem: Partial<Record<Kind, number>>): string {
  const names: Record<Kind, [string, string]> = {
    NIF: ['NIF', 'NIF'],
    NISS: ['NISS', 'NISS'],
    IBAN: ['IBAN', 'IBAN'],
    TELEFONE: ['telefone', 'telefones'],
    EMAIL: ['email', 'emails'],
    MATRÍCULA: ['matrícula', 'matrículas'],
    PROCESSO: ['número de processo', 'números de processo'],
    REFERÊNCIA: ['referência', 'referências'],
    NÚMERO: ['outro número', 'outros números'],
    MORADA: ['morada', 'moradas'],
    'CÓDIGO POSTAL': ['código postal', 'códigos postais'],
    NOME: ['nome', 'nomes'],
  };
  const parts = (Object.entries(contagem) as [Kind, number][]).map(
    ([k, n]) => `${n} ${names[k][n === 1 ? 0 : 1]}`,
  );
  if (parts.length === 0) return 'nenhum dado pessoal encontrado';
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
}
