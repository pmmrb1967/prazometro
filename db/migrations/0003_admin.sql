-- Fase 5: painel de admin e monitorização dos limites do plano gratuito.
-- O Worker monitor grava, de hora a hora, um valor por métrica e por dia (UTC); nunca por pedido.

CREATE TABLE usage_daily (
  date TEXT NOT NULL,          -- AAAA-MM-DD em UTC (os limites da Cloudflare reiniciam às 00:00 UTC)
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (date, metric)
);

-- No máximo um alerta por métrica, patamar e dia (a chave primária garante-o). Por agora os
-- alertas aparecem no painel de admin; o envio (por exemplo, WhatsApp) fica para depois.
CREATE TABLE alerts_sent (
  date TEXT NOT NULL,
  metric TEXT NOT NULL,
  threshold INTEGER NOT NULL,  -- 70 ou 90 (%), ou 0 se o monitor não conseguiu ler as estatísticas
  value REAL NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (date, metric, threshold)
);

-- Chamadas de IA com a chave do admin (fase 6), para o limite diário por utilizador.
CREATE TABLE ai_usage_daily (
  date TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, user_id, provider)
);
CREATE INDEX ai_usage_daily_user ON ai_usage_daily (user_id);

-- "Esta regra parece desatualizada": relatos anónimos, sem conta.
CREATE TABLE rule_reports (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'em_analise', 'resolvido', 'rejeitado')),
  updated_at INTEGER
);
CREATE INDEX rule_reports_status ON rule_reports (status, created_at);
CREATE INDEX rule_reports_created ON rule_reports (created_at);

-- Definições globais (por exemplo, o modo poupança e até quando dura).
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Como foi aberta cada sessão: o painel de admin só aceita sessões abertas com passkey.
ALTER TABLE sessions ADD COLUMN method TEXT NOT NULL DEFAULT 'antiga';
CREATE INDEX users_last_seen ON users (last_seen_at);
