-- Fase 8: partilha familiar cifrada ponta a ponta.
-- O dispositivo de quem partilha cifra os dados com uma chave aleatória que só existe na
-- ligação de convite (depois do #, que o navegador nunca envia ao servidor). O servidor guarda
-- só o texto cifrado e não consegue lê-lo. Apagar a linha retira o acesso.

CREATE TABLE family_shares (
  -- 128 bits aleatórios em base64url, gerados no dispositivo
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('garantia', 'sns', 'cartas', 'pos-obito')),
  version INTEGER NOT NULL,
  data BLOB NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX family_shares_owner ON family_shares (owner_id);
