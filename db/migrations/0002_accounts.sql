-- Fase 4: contas com passkeys, códigos de recuperação e cópias de segurança cifradas no cliente.
-- O servidor nunca guarda dados em claro: as cópias e as chaves de cifra chegam já cifradas.
-- Todas as colunas usadas em filtros têm índice (cada linha percorrida conta como lida no D1).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE passkeys (
  -- id da credencial em base64url
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX passkeys_user ON passkeys (user_id);

-- Guarda só o SHA-256 de um verificador derivado do código no dispositivo (HKDF); o código
-- nunca chega ao servidor. O código tem 120 bits aleatórios, por isso um hash simples basta.
CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX recovery_codes_user ON recovery_codes (user_id);

-- A chave das cópias, cifrada no dispositivo: com o código de recuperação ('recovery') ou com
-- o resultado PRF de uma passkey ('prf').
CREATE TABLE key_wraps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('recovery', 'prf')),
  credential_id TEXT,
  salt BLOB NOT NULL,
  iv BLOB NOT NULL,
  wrapped BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX key_wraps_user ON key_wraps (user_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('register', 'login', 'add')),
  user_id TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_challenges_expires ON auth_challenges (expires_at);

CREATE TABLE backup_versions (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  size INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploading', 'complete')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, version)
);

-- Blocos cifrados de no máximo 1,5 MB (o D1 aceita até 2 MB por valor).
CREATE TABLE backups (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, version, chunk_index)
);
