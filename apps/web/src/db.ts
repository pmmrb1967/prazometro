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

export type StoredFile = { id: string; nome: string; tipo: string; blob: Blob };

/** Dados para as cartas, guardados só se a pessoa quiser. */
export type Profile = { id: 'perfil'; nome: string; morada: string; local: string };

export const db = new Dexie('prazometro') as Dexie & {
  compras: EntityTable<Purchase, 'id'>;
  ficheiros: EntityTable<StoredFile, 'id'>;
  perfil: EntityTable<Profile, 'id'>;
};

db.version(1).stores({
  compras: 'id, data_entrega, criado_em',
  ficheiros: 'id',
  perfil: 'id',
});

export function newId(): string {
  return crypto.randomUUID();
}
