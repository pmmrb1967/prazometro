import type { AiProvider, Extraction } from '@prazometro/ai';
import Dexie, { type EntityTable } from 'dexie';
import { tombstoneId, type Tombstone } from './cloud/merge';

// Dados do utilizador: ficam só neste dispositivo (IndexedDB). Nunca vão para o servidor em claro.

/** Registos que vão nas cópias e na sincronização entre dispositivos. */
export type Synced = {
  /** Hora da última alteração neste ou noutro dispositivo (ms desde 1970), posta pela base. */
  atualizado_em?: number;
};

export type ItemState = 'novo' | 'recondicionado' | 'usado';
export type YesNoUnsure = 'sim' | 'nao' | 'nao_sei';

export type Purchase = Synced & {
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

export type WaitRequest = Synced & {
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

export type StoredFile = Synced & { id: string; nome: string; tipo: string; blob: Blob };

/** Dados para as cartas, guardados só se a pessoa quiser. */
export type Profile = Synced & {
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
  /** Hora da última sincronização (ms): o que mudou depois ainda não está na nuvem. */
  sincronizado_em?: number;
  /** Versão da cópia na nuvem já junta a este dispositivo (só se descarrega quando muda). */
  versao_nuvem?: number;
  /** Sincronizar sozinho ao abrir e ao sair da app (por defeito, sim). */
  sincronizar_sozinho?: boolean;
};

/** Uma carta recebida, lida no dispositivo (o texto nunca vai para a nuvem em claro). */
export type ReceivedLetter = Extraction &
  Synced & {
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

export type DeathProcess = Synced & {
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

export type ShareScope = 'garantia' | 'sns' | 'cartas' | 'pos-obito';

/** Partilha feita por esta pessoa. A chave só existe aqui e na ligação de convite. */
export type SentShare = {
  id: string;
  ambito: ShareScope;
  chave: string;
  /** Nome de quem partilha, mostrado a quem recebe (opcional). */
  de?: string;
  /** Para quem é (opcional, só neste dispositivo). */
  para?: string;
  /** SHA-256 dos dados enviados da última vez, para só reenviar quando mudam. */
  hash?: string;
  versao?: number;
  enviada_em?: string;
  criado_em: string;
};

/** Partilha recebida de outra pessoa, só de leitura. */
export type ReceivedShare = {
  id: string;
  ambito: ShareScope;
  chave: string;
  estado: 'ativa' | 'retirada';
  de?: string;
  versao?: number;
  /** Dados decifrados (o mesmo formato das tabelas locais). */
  dados?: ShareData;
  atualizada_em?: string;
  recebida_em: string;
};

export type ShareData = {
  compras?: Purchase[];
  pedidos_sns?: WaitRequest[];
  cartas?: ReceivedLetter[];
  processos_obito?: DeathProcess[];
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
  partilhas_enviadas: EntityTable<SentShare, 'id'>;
  partilhas_recebidas: EntityTable<ReceivedShare, 'id'>;
  apagados: EntityTable<Tombstone, 'id'>;
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

db.version(6).stores({
  partilhas_enviadas: 'id, criado_em',
  partilhas_recebidas: 'id, recebida_em',
});

db.version(7).stores({
  apagados: 'id, apagado_em',
});

// ---- Sincronização entre dispositivos ------------------------------------------------------
// Cada alteração a um registo sincronizado guarda a hora (atualizado_em) e cada apagamento deixa
// uma nota em "apagados". A junção com a nuvem (cloud/merge.ts) usa-as para ficar sempre com a
// alteração mais recente. Ao gravar o que veio da nuvem, as horas originais mantêm-se.

export const SYNCED_TABLES = [
  'compras',
  'pedidos_sns',
  'cartas',
  'processos_obito',
  'perfil',
  'ficheiros',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

let applyingRemote = false;

/** Grava o que veio da nuvem sem mudar as horas nem criar notas de apagamento novas. */
export async function applyRemote<T>(work: () => Promise<T>): Promise<T> {
  applyingRemote = true;
  try {
    return await work();
  } finally {
    applyingRemote = false;
  }
}

for (const name of SYNCED_TABLES) {
  const table = db.table<Synced & { id: string }, string>(name);
  table.hook('creating', (_key, obj) => {
    if (!applyingRemote) obj.atualizado_em = Date.now();
  });
  table.hook('updating', () => (applyingRemote ? undefined : { atualizado_em: Date.now() }));
  table.hook('deleting', function (key) {
    if (applyingRemote) return;
    const registo = String(key);
    // A nota grava-se depois, fora da transação do apagamento (que só abrange esta tabela).
    this.onsuccess = () => {
      setTimeout(() => {
        void db.apagados.put({
          id: tombstoneId(name, registo),
          tabela: name,
          registo,
          apagado_em: Date.now(),
        });
      });
    };
  });
}

export function newId(): string {
  return crypto.randomUUID();
}
