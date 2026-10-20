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

export const db = new Dexie('prazometro') as Dexie & {
  compras: EntityTable<Purchase, 'id'>;
  pedidos_sns: EntityTable<WaitRequest, 'id'>;
  ficheiros: EntityTable<StoredFile, 'id'>;
  perfil: EntityTable<Profile, 'id'>;
  nuvem: EntityTable<CloudState, 'id'>;
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

export function newId(): string {
  return crypto.randomUUID();
}
