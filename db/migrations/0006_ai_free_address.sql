-- IA gratuita: uma linha por rede (endereço IP) e por dia, para um script que invente um
-- identificador de dispositivo novo a cada pedido não gastar a quota de todos. Separada de
-- ai_free_daily para o monitor não contar a mesma leitura duas vezes.
-- O endereço é guardado como sha256(sal do dia + IP): o sal é aleatório, fica em settings
-- ('ia_sal_AAAA-MM-DD') e é apagado no dia seguinte, com estas linhas. Nunca se guarda o IP.
CREATE TABLE ai_free_address_daily (
  date TEXT NOT NULL,
  address TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  neurons INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, address)
);
