-- IA gratuita (Workers AI), sem conta: uma linha por dispositivo e por dia.
-- O dispositivo é guardado como sha256(dia + identificador aleatório do dispositivo): muda
-- todos os dias e não permite seguir ninguém de um dia para o outro. Nunca se guarda o IP
-- nem o texto da carta.
CREATE TABLE ai_free_daily (
  date TEXT NOT NULL,
  device TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  neurons INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, device)
);
