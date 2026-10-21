import type { AiProvider, Extraction } from '@prazometro/ai';
import Dexie, { type EntityTable } from 'dexie';

// Dados do utilizador: ficam só neste dispositivo (IndexedDB). Nunca vão para o servidor em claro.

export type ItemState = 'novo' | 'recondicionado' | 'usado';
export type YesNoUnsure = 'sim' | 'nao' | 'nao_sei';

export type Purchase = {
  id: string;
  produto: string;
  loja: string;
  loja_morada?: string;
  data_compra: string;
  data_entrega: string;
  estado: ItemState;
  /** Só para bens usados: ficou combinada uma garantia de 18 meses? */
  acordo_18_meses?: YesNoUnsure;
  tipo_vendedor: 'profissional' | 'particular';
  uso: 'pessoal' | 'profissional';
  preco?: number;
  fatura_id?: string;
  notas?: string;
  /** Dia em que comunicou o defeito à loja. */
  data_comunicacao?: string;
  /** Dia em que recebeu o bem dado em troca. */
  data_entrega_substituto?: string;
  criado_em: string;
};

/** Um pedido no SNS à espera de resposta (consulta, exame ou cirurgia). */
export type WaitType =
  | 'csp_consulta'
  | 'csp_consulta_servicos'
  | 'renovacao_medicacao'
  | 'documentos_csp'
  | 'consulta_hospitalar'
  | 'exame'
  | 'cirurgia';
export type Area = 'geral' | 'oncologica' | 'cardiaca';
export type Priority = 'muito_prioritaria' | 'prioritaria' | 'normal' | 'nao_sei';

export type WaitRequest = {
  id: string;
  tipo: WaitType;
  /** O que está à espera, nas palavras da pessoa (por exemplo, "consulta de Ortopedia"). */
  descricao: string;
  instituicao?: string;
  area?: Area;
  prioridade?: Priority;
  exame?: string;
  /** Data do pedido (centro de saúde e primeira consulta no hospital). */
  data_pedido?: string;
  /** Data da indicação do médico (exames e cirurgias). */
  data_indicacao?: string;
  data_marcada?: string;
  realizado_em?: string;
  notas?: string;
  criado_em: string;
};

export type StoredFile = { id: string; nome: string; tipo: string; blob: Blob };

/** Dados para as cartas, guardados só se a pessoa quiser. */
export type Profile = {
  id: 'perfil';
  nome: string;
  morada: string;
  local: string;
  numero_utente?: string;
};

/** Estado da cópia na nuvem neste dispositivo. A chave das cópias nunca sai daqui em claro. */
export type CloudState = {
  id: 'nuvem';
  chave: CryptoKey;
  ultima_copia?: string;
  incluir_fotos?: boolean;
};

/** Uma carta recebida, lida no dispositivo (o texto nunca vai para a nuvem em claro). */
export type ReceivedLetter = Extraction & {
  id: string;
  /** Texto lido por OCR ou colado, corrigido pela pessoa. */
  texto: string;
  /** Data escrita na carta. */
  data_carta?: string;
  /** Dia em que a pessoa recebeu a carta. */
  data_rececao?: string;
  /** Feita: a pessoa marcou que já tratou do assunto. */
  tratada_em?: string;
  fornecedor: AiProvider;
  criado_em: string;
};

/** Chave de IA cifrada com a chave local (AES-GCM). */
export type EncryptedSecret = { iv: Uint8Array; dados: ArrayBuffer };

/** Configuração da IA. Fica só neste dispositivo e nunca entra nas cópias de segurança. */
export type AiSettings = {
  id: 'ia';
  fornecedor: AiProvider;
  modelo_gemini?: string;
  modelo_claude?: string;
  /** Chave AES-GCM não exportável que cifra as chaves dos fornecedores. */
  chave_local: CryptoKey;
  chave_gemini?: EncryptedSecret;
  chave_claude?: EncryptedSecret;
  /** Contador local de uso: chamadas hoje e no total, por fornecedor. */
  uso: Partial<Record<AiProvider, { dia: string; hoje: number; total: number }>>;
};

/** Estado de cada passo do processo pós-óbito. */
export type StepState = 'por_fazer' | 'feito' | 'nao_aplica';

export type AssetType = 'conta' | 'imovel' | 'veiculo' | 'seguro' | 'contrato' | 'outro';

/** Um bem ou contrato da pessoa que faleceu (inventário). */
export type EstateAsset = {
  id: string;
  tipo: AssetType;
  descricao: string;
  /** Banco, seguradora ou empresa. */
  entidade?: string;
  tratado: boolean;
};

export type DeathProcess = {
  id: string;
  /** Opcional: só serve para as cartas e fica no dispositivo. */
  nome?: string;
  data_obito: string;
  /** Data do registo na conservatória; se faltar, os prazos contam da data do óbito. */
  data_registo_obito?: string;
  passos: Record<string, { estado: StepState; atualizado_em: string }>;
  bens: EstateAsset[];
  criado_em: string;
};

export const db = new Dexie('prazometro') as Dexie & {
  compras: EntityTable<Purchase, 'id'>;
  pedidos_sns: EntityTable<WaitRequest, 'id'>;
  ficheiros: EntityTable<StoredFile, 'id'>;
  perfil: EntityTable<Profile, 'id'>;
  nuvem: EntityTable<CloudState, 'id'>;
  cartas: EntityTable<ReceivedLetter, 'id'>;
  ia: EntityTable<AiSettings, 'id'>;
  processos_obito: EntityTable<DeathProcess, 'id'>;
};

db.version(1).stores({
  compras: 'id, data_entrega, criado_em',
  ficheiros: 'id',
  perfil: 'id',
});

db.version(2).stores({
  pedidos_sns: 'id, criado_em',
});

db.version(3).stores({
  nuvem: 'id',
});

db.version(4).stores({
  cartas: 'id, criado_em',
  ia: 'id',
});

db.version(5).stores({
  processos_obito: 'id, criado_em',
});

export function newId(): string {
  return crypto.randomUUID();
}
