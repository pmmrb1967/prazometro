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
    'requerido',
    'requerida',
    'exequente',
    'executado',
    'executada',
    'conservador',
    'oficial',
    'mandatário',
    'advogado',
    'advogada',
    'processo',
    'cédula',
    'declarante',
  ].map((w) => w.toLowerCase()),
);

/** Primeiras palavras de entidades: "Exequente: Banco Fictício, S.A." não é um nome a apagar. */
const ORGANIZATIONS = new Set([
  'banco',
  'caixa',
  'sociedade',
  'companhia',
  'instituto',
  'câmara',
  'município',
  'ministério',
  'autoridade',
  'agência',
  'serviço',
  'serviços',
  'tribunal',
  'conservatória',
  'juízo',
  'ordem',
  'fundo',
  'seguradora',
  'empresa',
  'condomínio',
  'estado',
  'fazenda',
]);

const LABELS = [
  String.raw`Exm[oa]s?\.?(?:\(a\))?[ \t]+(?:Senhor(?:\(a\)|a)?|Sr(?:a|\.ª|ª)?\.?(?:\(a\))?)`,
  String.raw`Prezad[oa](?:\(a\))?(?:[ \t]+(?:Senhor(?:\(a\)|a)?|Sr(?:a|\.ª|ª)?\.?))?`,
  String.raw`Car[oa](?:\(a\))?`,
  String.raw`(?:Sr|Sra|Dr|Dra|Eng)\.ª?`,
  String.raw`(?:Senhor|Senhora|D\.)`,
  String.raw`(?:Nome(?:\/Designação)?|NOME|Cliente|CLIENTE|Adquirente|ADQUIRENTE|Destinatário|DESTINATÁRIO|Arguid[oa]|ARGUID[OA]|Executad[oa](?:\(s\))?|EXECUTAD[OA]|Contribuinte|CONTRIBUINTE|Titular|TITULAR|Réu|Ré|RÉU|Requerid[oa]|Requerente|REQUERENTE|Exequente(?:\(s\))?|Declarante(?:\(s\))?|Pai|PAI|Mãe|MÃE|Cônjuge|Utente|UTENTE|Devedor(?:a)?|DEVEDOR)(?:[ \t]+(?:do|da)[ \t]+[${LOWER}]+)?[ \t]*:`,
];
// Ruído do OCR entre o rótulo e o nome: "Requerido: |", "Requerente: :", "*** :".
const NOISE = `[ \\t|:;"'“”*]`;
// Uma letra minúscula colada ao nome ("iAna") também é ruído do OCR.
const JUNK = `(?:[${LOWER}](?=[${UPPER}]))?`;
// O nome pode vir na mesma linha ou na linha seguinte ("Exma. Senhora\nAna Carvalho").
const LABELLED_NAME = new RegExp(
  `(${LABELS.join('|')})((?:${NOISE}*\\n)?${NOISE}*${JUNK})(${NAME})`,
  'gu',
);

/**
 * Papéis seguidos de um nome sem ":" ("Conservador, Vítor Silva", "Advogada, Ana Sousa",
 * "Executado(s) Rui Costa", "agente de execução ANTÓNIO REIS", "Viúvo(a) José Lima").
 * Exige pelo menos duas palavras, para não apanhar "Agente de Execução PROCESSO".
 */
const ROLES = [
  String.raw`Conservador(?:a)?`,
  'CONSERVADOR',
  String.raw`Advogad[oa]`,
  String.raw`Secretári[oa]`,
  String.raw`Oficial de registos`,
  String.raw`Mandatári[oa]`,
  'MANDATÁRIO',
  String.raw`Solicitador(?:a)?`,
  String.raw`[Aa]gente de [Ee]xecução`,
  'AGENTE DE EXECUÇÃO',
  String.raw`Juiz(?:a)?`,
  String.raw`Procurador(?:a)?`,
  String.raw`Notári[oa]`,
  'Testemunha',
  'Requerente',
  String.raw`Requerid[oa]`,
  String.raw`Exequente(?:\(s\))?`,
  String.raw`Executad[oa](?:\(s\))?`,
  String.raw`Viúv[oa](?:\(a\))?`,
  String.raw`Casad[oa](?:\(a\))?(?:[ \t]+com)?`,
  'mim',
];
const NAME_2 = `${WORD}(?:[ \\t]+(?:${CONNECTOR}[ \\t]+)?${WORD}){1,6}`;
const ROLE_NAME = new RegExp(
  `(?<![\\p{L}])((?:${ROLES.join('|')})(?![\\p{L}])[ \\t]*[,:]?(?:${NOISE}*\\n)?${NOISE}*${JUNK})(${NAME_2})`,
  'gu',
);

/** Moradas indicadas por um rótulo, com a linha seguinte se continuar a morada (tem números). */
const LABELLED_ADDRESS =
  /((?:Morada|MORADA|Naturalidade|NATURALIDADE|Sepultad[oa]|[Rr]esid[êe]ncia(?:[ \t]+habitual)?(?:[ \t]+em)?|[Rr]esidente[ \t]+em|[Dd]omic[íi]lio(?:[ \t]+profissional)?(?:[ \t]+(?:em|na|no))?)[ \t]*:?[ \t]*)([^\n]{3,100}(?:\n(?![^\n]*:)[^\n]{0,60}\d[^\n]{0,60})?)/gu;

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
  'Al\\.',
  'Al',
];
const STREET_ALL = [...STREET, ...STREET.map((s) => s.toUpperCase())];
const ADDRESS = new RegExp(`\\b(?:${STREET_ALL.join('|')})[ \\t][^\\n]{0,100}`, 'gu');

const POSTAL = new RegExp(
  `\\b\\d{4}-\\d{3}(?:[ \\t]+[${UPPER}][\\p{L}'’-]*(?:[ \\t]+(?:d[aeo]s?|[${UPPER}][\\p{L}'’-]*))*)?`,
  'gu',
);

const REFERENCE = new RegExp(
  String.raw`\b((?:[Pp]rocesso|PROCESSO|[Pp]roc\.|[Aa]uto|AUTO|[Rr]eferência|REFERÊNCIA|[Rr]ef\.|[Cc]ontrato|CONTRATO|[Cc]liente|CLIENTE|[Cc]onta|CONTA|[Aa]pólice|[Dd]ocumento|DOCUMENTO|[Ff]atura|FATURA|[Nn]ota de cobrança|[Ll]icença|[Cc]ertidão|[Ii]nstalação|CPE|CIL|[Cc]artão de [Cc]idadão|[Cc]édula|CÉDULA)(?:[ \t]+(?:n\.?[ \t]?[ºo°]\.?|número|nr\.?|N\.?º))?[ \t]*[:-]?[ \t]*)([A-Za-z0-9][A-Za-z0-9/.\-]{2,}[A-Za-z0-9])`,
  'gu',
);
const COURT_CASE = /\b\d{1,7}\/\d{2,4}\.\d{0,2}[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*\b/g;
/** "n.º 723/2021", "nº 5985/2008": números de processos e de assentos (as leis já estão protegidas). */
const NUMBERED_CASE = /((?:\bn\.?[ \t]?[ºo°]\.?|\bnº)[ \t]*)(\d{1,7}\/\d{2,4})\b/g;
/** Referências internas como "PEDel/19/2021". */
const INTERNAL_REF = /\b[A-Za-z]{2,8}\/\d{1,6}\/\d{2,4}\b/g;
/** Registos dos CTT ("RA123456789PT"). */
// O OCR troca às vezes um algarismo por uma letra ("RAS59540499PT").
const TRACKING = /\b[A-Z]{2,3}\d{8,9}[A-Z]{2}\b/g;
// O IBAN pode ser partido pelo OCR em duas linhas.
const IBAN = /\b[A-Z]{2}\d{2}(?:[ \n]?[A-Z0-9]{4}){3,7}(?:[ \n]?[A-Z0-9]{1,3})?\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** O OCR lê muitas vezes o "@" como "&"; e o que vem depois de "Email:" é sempre um email. */
const EMAIL_OCR = /[\w.+-]+&[\w-]+(?:\.[\w-]+)+/g;
const LABELLED_EMAIL = /(\b[Ee]-?mail[ \t]*:[ \t]*)([^\s[]\S*)/g;
const PLATE =
  /\b(?:[A-Z]{2}[- ·]\d{2}[- ·](?:\d{2}|[A-Z]{2})|\d{2}[- ·][A-Z]{2}[- ·]\d{2}|\d{2}[- ·]\d{2}[- ·][A-Z]{2})\b/g;
const LONG_NUMBER = /(?<![\w/])(?:\+\s?)?\d(?:[ .]?\d){6,}(?![\w/])/g;
/** Montantes ("1.234,56 €") e referências legais ("Lei n.º 7/2009", "artigo 175.º"): protegidos. */
const AMOUNT =
  /\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b|\b\d+\.\d{2}(?=[ \t]*(?:€|EUR\b|[Ee]uros?\b))/g;
const LAW =
  /\b(?:Lei|Decreto-Lei|DL|Portaria|Despacho|Regulamento|Decreto Regulamentar)(?:[ \t]+n\.?[ \t]?º)?[ \t]*\d+(?:[-/][\dA-Z]+)*(?:\/\d+)?/g;

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ACCENTS: Record<string, string> = {
  a: '[aáàâãä]',
  e: '[eéèêë]',
  i: '[iíìîï]',
  o: '[oóòôõö]',
  u: '[uúùûü]',
  c: '[cç]',
};

/** Expressão que aceita a palavra com ou sem acentos (usar com a bandeira "i"). */
function accentless(word: string): string {
  return [...word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()]
    .map((ch) => ACCENTS[ch] ?? escape(ch))
    .join('');
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
    .replace(EMAIL_OCR, () => mark('EMAIL'))
    .replace(LABELLED_EMAIL, (_m, label: string) => `${label}${mark('EMAIL')}`)
    .replace(TRACKING, () => mark('REFERÊNCIA'))
    .replace(IBAN, () => mark('IBAN'))
    .replace(COURT_CASE, () => mark('PROCESSO'))
    .replace(NUMBERED_CASE, (_m, label: string) => `${label}${mark('PROCESSO')}`)
    .replace(INTERNAL_REF, () => mark('REFERÊNCIA'))
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
  t = t
    .replace(LABELLED_ADDRESS, (_m, label: string) => `${label}${mark('MORADA')}`)
    .replace(ADDRESS, () => mark('MORADA'))
    .replace(POSTAL, () => mark('CÓDIGO POSTAL'));

  // 4. Nomes: depois de "Exmo. Senhor", "Nome:", etc., os indicados pela pessoa e os mesmos
  //    nomes noutros sítios da carta.
  const found = new Set<string>();
  for (const n of options.nomes ?? []) {
    for (const w of n.split(/\s+/)) if (w.length >= 3) found.add(w);
  }
  const replaceName = (m: string, before: string, name: string) => {
    const words = name.split(/[ \t]+/).filter((w) => !/^(?:d[aeo]s?|e)$/i.test(w));
    if (words.every((w) => NOT_NAMES.has(w.toLowerCase()))) return m;
    if (ORGANIZATIONS.has(words[0]!.toLowerCase())) return m;
    for (const w of words) if (w.length >= 3 && !NOT_NAMES.has(w.toLowerCase())) found.add(w);
    return `${before}${mark('NOME')}`;
  };
  t = t
    .replace(LABELLED_NAME, (m, label: string, space: string, name: string) =>
      replaceName(m, label + space, name),
    )
    .replace(ROLE_NAME, (m, role: string, name: string) => replaceName(m, role, name));
  // Linha só com um nome, logo acima de uma morada (bloco do destinatário).
  t = t.replace(
    new RegExp(`^([ \\t]*)(${NAME})[ \\t]*\\n(?=[ \\t]*\\[MORADA\\])`, 'gmu'),
    (_m, indent: string, name: string) => {
      for (const w of name.split(/[ \t]+/)) if (w.length >= 3) found.add(w);
      return `${indent}${mark('NOME')}\n`;
    },
  );
  if (found.size) {
    // Sem distinguir acentos nem maiúsculas: "Vítor" e "Vitor", "António" e "ANTONIO".
    const words = [...found].sort((a, b) => b.length - a.length).map(accentless);
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
