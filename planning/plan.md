# Prazómetro — Plano do projeto

Versão 0.1 · 20 de outubro de 2026

## 1. Descrição

O Prazómetro é uma app web gratuita (PWA), em português europeu, que transforma direitos e burocracia em **prazos claros e ações concretas**. A pessoa regista uma compra, uma consulta pedida no SNS ou fotografa uma carta oficial, e a app diz-lhe até quando pode agir, o que deve fazer e gera a carta necessária.

### Problema

- As cartas oficiais estão escritas em linguagem opaca, sobretudo para pessoas 65+ e imigrantes.
- Os consumidores não sabem que a garantia é de 3 anos nem que, a partir do 3.º ano, o ónus da prova muda. Perdem o prazo ou desistem perante a recusa das lojas.
- Muitos utentes do SNS esperam além do tempo máximo de resposta garantido sem saberem que têm direitos.
- Depois de um óbito, as famílias enfrentam um processo confuso, com prazos e custos dispersos.

### Lacuna

Só existem modelos de carta estáticos e artigos. Não foi encontrada em Portugal uma ferramenta pessoal que junte regras com fonte, cálculo de prazos, lembretes e geração de cartas.

### Fora do âmbito

- Aconselhamento jurídico sobre casos concretos.
- Submissão automática de reclamações ou requerimentos em nome do utilizador.
- Estatuto do cuidador informal (fica na App B, mas reutiliza este motor).

## 2. Princípios

1. O motor de regras calcula, a IA só lê.
2. Local-first: os dados ficam no dispositivo. O servidor só guarda contas, cópias cifradas no cliente e estatísticas agregadas.
3. Custo zero: só Cloudflare gratuito, sem R2 nem nada que exija cartão.
4. Cada regra tem fonte e data de verificação.
5. Informação geral, nunca aconselhamento jurídico (Lei 49/2004).
6. Acessível a 65+ e sem conta obrigatória.

## 3. Arquitetura

```
┌──────────────────────── Dispositivo ────────────────────────┐
│ PWA React                                                    │
│  ├─ IndexedDB (Dexie): compras, pedidos SNS, cartas, notas   │
│  ├─ Motor de regras (packages/engine) + regras JSON          │
│  ├─ OCR (Tesseract.js) · PDF (pdf-lib) · .ics                │
│  ├─ Anonimização antes de qualquer envio                     │
│  └─ IA com chave própria → Gemini / Claude (direto)          │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS (só dados cifrados ou anonimizados)
┌──────────────▼──────────── Cloudflare (gratuito) ───────────┐
│ Worker app: PWA e regras como static assets (gratuitos)      │
│ Worker api (Hono): passkeys, cópias, proxy IA admin,         │
│                    partilha familiar, painel admin           │
│ Worker monitor (Cron, de hora a hora): GraphQL Analytics,    │
│                    uso diário, alertas por WhatsApp          │
│ D1: contas, cópias em blocos, partilhas, estatísticas        │
│ WhatsApp: CallMeBot, só para o número do admin               │
└──────────────────────────────────────────────────────────────┘
```

### Decisões técnicas

| Tema                       | Decisão                                                                       | Motivo                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Armazenamento de ficheiros | D1 em blocos de 1,5 MB, sem R2                                                | O R2 exige cartão para ser ativado                                                                      |
| Fotos                      | Ficam no dispositivo. Na cópia só se o utilizador quiser, comprimidas em WebP | Poupa espaço no D1 (500 MB por base)                                                                    |
| Autenticação               | Passkeys (WebAuthn) com código de recuperação                                 | O email gratuito só chega a endereços verificados, por isso não serve para links mágicos a utilizadores |
| Cifra                      | PBKDF2 + AES-GCM via WebCrypto, chave derivada no cliente                     | O servidor nunca vê dados em claro; não gasta CPU do Worker                                             |
| Lembretes                  | `.ics` para o calendário do utilizador                                        | Não precisa de servidor de push                                                                         |
| IA                         | Camada de fornecedores com o mesmo esquema JSON                               | Permite Gemini, Claude ou nenhuma, sem mudar a app                                                      |
| Localização                | D1 com jurisdição UE (`--jurisdiction eu`): dados só na UE                    | RGPD                                                                                                    |

## 4. Modelo de dados

### 4.1 IndexedDB (dispositivo)

| Tabela             | Campos principais                                                                     |
| ------------------ | ------------------------------------------------------------------------------------- |
| `compras`          | id, produto, loja, data_compra, estado (novo/usado), preco, foto_fatura_id, notas     |
| `pedidos_sns`      | id, tipo (consulta/cirurgia), especialidade, prioridade, data_pedido, unidade, estado |
| `cartas_recebidas` | id, emissor, data_carta, texto_ocr, resumo, prazo_calculado, regra_id                 |
| `cartas_geradas`   | id, modelo_id, campos, data, pdf_id                                                   |
| `processos_obito`  | id, data_obito, passos (estado por passo), bens                                       |
| `ficheiros`        | id, tipo, blob (fotos e PDFs)                                                         |
| `config`           | fornecedor_ia, modelo, chave_cifrada, tamanho_letra, consentimentos                   |

### 4.2 D1 (servidor)

```sql
users            (id, created_at, last_seen_at, role)             -- role: user | admin
passkeys         (id, user_id, credential_id, public_key, counter, created_at)
recovery_codes   (id, user_id, code_hash, used_at)
backups          (user_id, version, chunk_index, chunk_count, data BLOB, created_at)
family_shares    (id, owner_id, member_id, scope, created_at, revoked_at)
usage_daily      (date, metric, value)                            -- agregado de hora a hora
ai_usage_daily   (date, user_id, provider, calls)                 -- só para a chave do admin
alerts_sent      (date, metric, threshold)
rule_reports     (id, rule_id, message, created_at, status)       -- "esta regra está desatualizada?"
```

Índices em todas as colunas usadas em filtros (`user_id`, `date`, `rule_id`).

## 5. Formato das regras

Exemplo (`rules/garantia/garantia-bens-novos.json`):

```json
{
  "id": "garantia.bens-novos",
  "modulo": "garantia",
  "titulo": "Garantia legal de bens novos",
  "descricao": "Os bens novos comprados a um vendedor profissional têm garantia legal de 3 anos.",
  "condicoes": { "estado": "novo", "vendedor": "profissional" },
  "prazo": {
    "quantidade": 3,
    "unidade": "anos",
    "contagem": "corridos",
    "transita_dia_util": false
  },
  "marcos": [
    {
      "id": "fim-presuncao",
      "quantidade": 2,
      "unidade": "anos",
      "alerta_dias_antes": 30,
      "texto": "A partir daqui, pode ter de provar que o defeito já existia na entrega."
    }
  ],
  "fontes": [
    {
      "titulo": "Decreto-Lei n.º 84/2021",
      "url": "https://diariodarepublica.pt/",
      "artigo": "a confirmar"
    }
  ],
  "modelos_carta": ["garantia.reclamacao-vendedor"],
  "verificado_em": "2026-10-20",
  "verificado_por": "por preencher",
  "estado": "a_rever",
  "notas": "Confirmar artigos e regime de bens usados antes de publicar."
}
```

## 6. Fases e tarefas

Estimativas indicativas, em semanas de trabalho a solo com Claude Code.

Estado em 2026-10-21 (o que falta validar está na secção 10):

| Fase                      | Estado                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------- |
| 0 — Fundação              | Feita                                                                              |
| 1 — Motor de regras       | Feita                                                                              |
| 2 — Garantia              | Feita (falta revisão jurídica)                                                     |
| 3 — Espera no SNS         | Feita (falta revisão jurídica)                                                     |
| 4 — Contas e cópia        | Feita                                                                              |
| 5 — Admin e monitorização | Feita (por validar; canal de alertas por decidir)                                  |
| 6 — Cartas com IA         | Feita (IA gratuita com Workers AI), exceto o teste com cartas reais                |
| 7 — Pós-óbito             | Aberta com aviso "Em desenvolvimento"; falta revisão jurídica e teste com famílias |
| 8 — Partilha familiar     | Feita (por validar)                                                                |
| 9 — Lançamento            | Feita, exceto a consulta da marca e as publicações (do autor)                      |

### Fase 0 — Fundação (0,5 sem)

- [x] Criar repositório `pmmrb1967/prazometro` com npm workspaces (`apps`, `workers`, `packages`)
- [x] Configurar TypeScript, ESLint, Prettier e Vitest partilhados
- [x] PWA mínima (Vite + React + vite-plugin-pwa) com ecrã inicial, aviso legal e convite para instalar
- [x] Base de acessibilidade: tamanho de letra ajustável, alto contraste, foco visível
- [x] Publicação automática no `main` (GitHub Actions + `wrangler deploy`): a PWA é servida pelo Worker `app` como static assets, em vez do Cloudflare Pages
- [x] Worker com Hono e rota `/api/health`
- [x] Criar base D1 `prazometro` com localização na Europa e primeira migração vazia (jurisdição UE)
- [x] GitHub Actions: lint, testes e `validate:rules` em cada push

**Concluída quando**: a PWA está publicada em `app.prazometro.workers.dev`, instalável no telemóvel, e o Worker responde.

**Concluída em 2026-10-20**: instalação testada com sucesso num telemóvel.

### Fase 1 — Motor de regras (1 sem)

- [x] Esquema zod das regras e exportação para JSON Schema
- [x] Script `validate:rules` (falha sem `fontes` ou `verificado_em`)
- [x] Calendário de feriados nacionais, incluindo os móveis (Sexta-feira Santa, Páscoa, Corpo de Deus)
- [x] Cálculo de prazos: dias corridos e úteis, meses e anos, fim de mês, transição para o dia útil seguinte
- [x] Avaliador de condições das regras
- [x] Marcos e alertas (por exemplo, 30 dias antes do fim do 2.º ano)
- [x] Estado de verificação: marcar como "a verificar" as regras com mais de 6 meses
- [x] Gerador de cartas: modelos Markdown com `{{campos}}` para PDF (pdf-lib)
- [x] Exportação `.ics` com alarmes
- [x] Testes: pelo menos 30 casos de datas (feriados, fins de semana, 29 de fevereiro, fim de mês)

**Concluída quando**: o motor calcula prazos de regras de exemplo com 100% dos testes a passar.

**Concluída em 2026-10-20**: 95 testes do motor a passar, 59 deles de datas e feriados. Decisões:

- Feriados e art. 279.º do Código Civil confirmados no texto consolidado do Diário da República em 2026-10-20.
- Por defeito, um prazo que termine num sábado não transita (CC, art. 279.º, e)). Regras de prazos perante serviços fechados ao sábado indicam `"transicao": "sabado_domingo_feriado"`.
- Ainda não há regras reais em `rules/`: a recolha com fontes verificadas começa na Fase 2. Os testes usam uma regra fictícia.
- O PDF usa Helvetica por defeito e recusa caracteres que ela não tem (por exemplo, Ł ou cirílico), em vez de os trocar. Na Fase 2, a app passa a fonte Atkinson Hyperlegible para suportar todos os nomes.
- Os alarmes do `.ics` tocam às 09:00, nunca à meia-noite.

### Fase 2 — Módulo Garantia (1 sem)

- [x] Recolher e validar as regras (bens novos, usados, reparação, substituição) com fontes
- [x] Formulário de compra: produto, loja, data, novo ou usado, foto da fatura
- [x] Lista de compras com estado da garantia (barra de tempo e próximos marcos)
- [x] Exportação dos alertas para o calendário
- [x] Fluxo de reclamação: carta à loja, Livro de Reclamações eletrónico, centro de arbitragem
- [x] Modelos de carta: reclamação ao vendedor e pedido de reparação ou substituição
- [x] Exportar e importar cópia de segurança local (ficheiro), antes de existir sincronização
- [ ] Teste com 5 pessoas reais, incluindo pelo menos 2 com mais de 65 anos

**Concluída quando**: uma pessoa regista uma compra, recebe o lembrete no calendário e gera a carta sem ajuda.

Notas da Fase 2 (2026-10-20):

- Regras em `rules/garantia/` (DL 84/2021): prazo geral de 3 anos, usados com 18 meses combinados, 30 dias para reparar, caducidade 2 anos após a comunicação e garantia do bem substituído. Esta última está "a rever": falta um jurista confirmar a interpretação. Todas foram verificadas no DR por mim (Claude), não por um jurista.
- Ainda não se somam os 6 meses por cada reparação nem a suspensão do prazo durante a reparação: as datas mostradas são as mais cedo possíveis e a app avisa disso.
- Num bem usado, "não sei" se houve acordo de 18 meses usa por precaução o prazo mais curto.
- Compras anteriores a 2022 (DL 67/2003) não são calculadas; a app explica porquê.
- O PDF usa a Atkinson Hyperlegible (subconjuntos latin + latin-ext). Nomes em cirílico, árabe, etc. ainda não são suportados: a app avisa em vez de desenhar quadrados.
- Falta o teste com 5 pessoas reais (tarefa do autor).

### Fase 3 — Módulo Espera no SNS (1 sem)

- [x] Recolher a tabela de TMRG em vigor (portaria) com fonte e data
- [x] Formulário: tipo, especialidade, prioridade e data do pedido
- [x] Indicador "dentro do prazo" ou "prazo ultrapassado há X dias"
- [x] Explicação dos direitos e dos passos seguintes
- [x] Modelos de carta: pedido de informação e reclamação
- [x] Testes com casos de cada nível de prioridade

**Concluída quando**: o cálculo coincide com 10 casos verificados manualmente na tabela oficial.

Notas da Fase 3 (2026-10-20):

- A tabela em vigor é a da Portaria n.º 153/2017 **na redação da Portaria n.º 137/2026/1** (em vigor desde 2 de abril de 2026). Mudou bastante: primeira consulta no hospital 30/60/120 dias; cirurgias só com prioridade "prioritária" (30 dias) e "normal" (180, oncológica 60, cardíaca 90). As regras ficam em `rules/sns/` (20 regras), verificadas no DR por mim (Claude), sem revisão de jurista.
- A gestão das listas de espera passou para o SINACC (Decreto-Lei n.º 12/2026 e Portaria n.º 135/2026/1, que revogou o SIGIC). O "ponto crítico" que dispara o encaminhamento para outra entidade é fixado no sistema, não na lei, por isso a app não o calcula; só explica o direito. Já não existe o vale cirurgia com percentagem fixa.
- Contagem: a partir do dia seguinte ao pedido ou à indicação, sem passar para o dia útil seguinte (a portaria não o diz). Os cuidados de saúde primários contam em dias úteis (feriados nacionais; os municipais não). As 72 horas são tratadas como 3 dias.
- Oncologia e Cardiologia com prioridade "normal" na primeira consulta não têm tempo fixado na portaria: a app diz isso e propõe a carta de pedido de informação. Não se aplica por analogia o tempo geral de 120 dias.
- A pendência clínica (até 3 meses, nas cirurgias) não é descontada; a app avisa.
- Os testes do motor (`sns.test.ts`) têm 13 casos contados à mão no calendário, com feriados e fins de mês. Falta o autor confirmar 10 casos com a tabela oficial, como pede o critério de conclusão.
- As cartas e a cópia de segurança passaram a ser comuns aos módulos (`components/LetterForm.tsx`, `components/BackupPanel.tsx`); a cópia inclui os pedidos do SNS.

### Fase 4 — Contas e cópia de segurança (1 sem)

- [x] Migrações D1: `users`, `passkeys`, `recovery_codes`, `backups` (`db/migrations/0002_accounts.sql`, com `key_wraps`, `sessions`, `auth_challenges` e `backup_versions`)
- [x] Registo e entrada com passkeys (WebAuthn) e códigos de recuperação (SimpleWebAuthn; sem email nem palavra-passe; sessão em cookie HttpOnly e só o hash no servidor)
- [x] Cifra no cliente: chave derivada (PBKDF2) e AES-GCM com WebCrypto (chave aleatória das cópias, embrulhada com o código de recuperação via PBKDF2 e, quando o dispositivo suporta, com a extensão PRF da passkey)
- [x] Envio da cópia em blocos de 1,5 MB, com versão e verificação de integridade (gzip, AES-GCM por bloco ligado à versão e posição; o servidor confirma número de blocos e tamanho)
- [x] Restauro noutro dispositivo (com a passkey sincronizada ou com o código; testado no navegador com autenticador virtual)
- [x] Opção de incluir fotos na cópia (comprimidas em WebP, até 1600 px)
- [x] Apagar conta e todos os dados (direito ao apagamento, RGPD)
- [x] Testes de cópia e restauro com 1 MB, 5 MB e 20 MB (`apps/web/src/cloud/crypto.test.ts`; envio e receção de 5 MB no Worker em `workers/api/src/backup.test.ts`)

Limites: 20 MB por pessoa e 400 MB no total (o D1 tem 500 MB por base), e só se guarda a última cópia de cada pessoa.

**Concluída quando**: um utilizador muda de telemóvel e recupera tudo, e o servidor só tem BLOBs cifrados.

### Fase 5 — Painel de admin e monitorização (1 sem)

- [x] Migrações: `usage_daily`, `alerts_sent`, `ai_usage_daily`, `rule_reports` (`db/migrations/0003_admin.sql`, com `settings` e o método de entrada em `sessions`)
- [x] Worker `monitor` com Cron Trigger de hora a hora (ao minuto 5, sem endereço público)
- [x] Leitura da GraphQL Analytics API (`d1AnalyticsAdaptiveGroups`, pedidos ao Worker) com token só de leitura (segredo `CF_ANALYTICS_TOKEN`, "Account Analytics: Read"; a gravar desde 2026-10-21)
- [x] Tamanho de cada base e da conta, comparado com 500 MB e 5 GB (sem token, o tamanho da base sai da própria consulta ao D1)
- [x] Envio dos alertas ao admin por WhatsApp com o CallMeBot (`workers/monitor/src/notify.ts`; segredos `WHATSAPP_PHONE` e `WHATSAPP_APIKEY`). O Email Routing exige domínio próprio (pago) e a API oficial do WhatsApp cobra cada mensagem e pede meio de pagamento; o CallMeBot é gratuito para uso pessoal, só envia para o número do admin, e a mensagem leva só números agregados. **Ativação pendente** (ver secção 10); se o CallMeBot não responder, passar para Web Push
- [ ] **Alternativa provável: alertas por notificação da própria app (Web Push)**, como no Validómetro (`src/worker/webpush.ts`, VAPID e RFC 8291/8292 só com WebCrypto): subscrição do admin no painel, envio pelo Worker `monitor`, sem serviços de terceiros. No iPhone exige a app instalada no ecrã principal. Fazer se a ativação do CallMeBot falhar, ou em vez dele, por ser mais fiável
- [x] Alertas aos 70% e 90%, no máximo um por métrica, patamar e dia (registados em `alerts_sent` e mostrados no painel; o envio ao admin liga-se num só ponto de `workers/monitor/src/monitor.ts`)
- [x] Modo poupança aos 90%: desliga o proxy de IA do admin e suspende cópias até às 00:00 UTC (as cópias já param; o proxy de IA usa `savingsMode` na fase 6)
- [x] Rota `/admin` protegida (papel `admin` e passkey)
- [x] Admin sem SQL: segredo `ADMIN_IDS` com os ids das contas de admin (o papel `admin` na D1 continua a valer)
- [x] Página "A minha conta" (`/conta`) com "Entrar" na barra de topo: explica o uso sem conta, com conta e com a família; junta a cópia na nuvem, a partilha, o acesso e o painel de admin (`/copia` reencaminha)
- [x] Painel com gráficos dos últimos 30 dias: armazenamento, linhas lidas e escritas, pedidos, chamadas de IA, utilizadores ativos
- [x] Lista de relatos "regra desatualizada" com estado (botão em "De onde vêm estas datas", sem conta, no máximo 100 por dia)
- [ ] ~~Opcional: alerta também por bot de Telegram~~ (posto de lado em 2026-10-21: ver o canal de envio acima)

**Concluída quando**: simulando 90% de uso, o admin recebe o email e o modo poupança liga-se e desliga-se sozinho.

### Fase 6 — Cartas explicadas com IA (2 sem)

- [x] OCR no dispositivo com Tesseract.js (`por`), com pré-processamento (recorte, contraste, rotação). Ficheiros do OCR servidos pelo próprio site (`/ocr/`), sem CDN. Cartas em PDF com o pdf.js: texto tirado diretamente dos PDF digitais e OCR página a página dos digitalizados (até 5 páginas)
- [x] Anonimização: NIF, NISS, IBAN, nomes, moradas, números de processo e matrículas (também telefones, emails, referências e códigos postais), no dispositivo e outra vez no Worker
- [x] Pacote `packages/ai` com interface comum `extrair(texto) → JSON`
- [x] Fornecedor `none`: identificação do emissor por palavras-chave (AT, Segurança Social, tribunais, bancos, operadoras, SNS)
- [x] Fornecedor `workers-ai`, gratuito e por defeito, como no Validómetro (2026-11-13): Workers AI (`@cf/google/gemma-4-26b-a4b-it`, resposta em JSON Schema) em `/api/ai/gratuita` (`workers/api/src/ai-free.ts`), sem chave nem conta. Limites: 10 leituras por dispositivo e por dia (identificador aleatório; o servidor guarda só `sha256(dia + id)` em `ai_free_daily`, migração 0005, apagado no dia seguinte) e, para todos, os 10 000 neurons diários menos 1 000 de reserva. Pausa no modo poupança. O monitor conta os neurons (`ia_neurons`) e alerta aos 70% e 90%, sem ligar o modo poupança. "Testar ligação" e leituras que restam hoje em `/cartas/ia`
- [ ] Fornecedor `gemini-admin` via Worker, com limite diário por utilizador. Código feito e testado (10 leituras por conta e 200 no total por dia, pausa no modo poupança), mas **desligado**: os termos da API Gemini só permitem serviços pagos em aplicações disponibilizadas a utilizadores no Espaço Económico Europeu (2026-10-21). Liga-se com `AI_ADMIN = "ligado"` e o segredo `GEMINI_API_KEY` se houver uma chave paga ou os termos mudarem
- [x] Fornecedor `gemini-own`, com chamada direta do navegador (modelo por defeito `gemini-3.5-flash-lite`)
- [x] Fornecedor `claude-own`, com chamada direta e cabeçalho `anthropic-dangerous-direct-browser-access`, modelo por defeito `claude-haiku-5-5`
- [x] Ecrã de configuração: escolher fornecedor, colar a chave, "Testar chave" e contador local de uso
- [x] Chaves guardadas cifradas no dispositivo (AES-GCM com chave local não exportável; fora das cópias de segurança)
- [x] Esquema JSON da resposta (emissor, assunto, datas, pedido, consequências) validado com zod. Datas que não estão escritas na carta são descartadas
- [x] Ligação ao motor: se a carta corresponder a uma regra, o prazo é calculado pelo motor e não pela IA (`rules/cartas/`: multa de trânsito, audição prévia nas Finanças e citação para contestar, todas "a rever" até revisão por jurista)
- [x] Ecrã de resultado: quem enviou, o que pede, até quando, o que fazer, com aviso legal
- [ ] Conjunto de teste com 30 cartas reais anonimizadas e taxa de acerto do emissor e das datas. Feito com 30 cartas **fictícias** (`packages/ai/src/fixtures/letters.ts`): o modo sem IA acerta mais de 90% no emissor e nas datas. Faltam cartas reais anonimizadas

**Concluída quando**: acerto de pelo menos 90% no emissor e nas datas no conjunto de teste, e nenhum dado pessoal sai do dispositivo sem anonimização.

### Fase 7 — Pós-óbito e heranças (2 sem)

- [x] Levantamento de passos, prazos e custos com fontes (registo, AT, Segurança Social, bancos, habilitação de herdeiros): 6 regras em `rules/pos-obito/` e 11 passos, todos "a rever". O motor ganhou `fim_do_mes` para "até ao final do 3.º mês seguinte"
- [ ] Registar divergências entre fontes e resolvê-las com um jurista (registadas nas `notas` das regras e em `docs/pos-obito-revisao.md`; falta o jurista)
- [x] Checklist cronológica com estado por passo (por fazer, tratado, não se aplica) e lembretes `.ics`
- [x] Inventário de bens (contas, imóveis, veículos, seguros, subscrições), com carta sugerida por bem
- [x] Modelos de carta: cancelamento de contratos, comunicação a bancos e seguradoras
- [ ] **Revisão jurídica completa antes de divulgar** (desde 2026-10-21 o módulo está aberto a todos, por decisão do autor, com o aviso "Em desenvolvimento" em todas as páginas)
- [ ] Fazer a revisão jurídica do pós-óbito antes das publicações no LinkedIn e nos grupos (fase 9); se não estiver feita, voltar a esconder o módulo
- [ ] Linguagem cuidada e tom sensível (testar com pessoas que passaram pelo processo)

**Concluída quando**: um jurista valida o conteúdo e 3 famílias testam o fluxo.

### Fase 8 — Partilha familiar (1–2 sem, opcional)

- [x] Só avançar se houver pedidos de utilizadores (o autor pediu para avançar a 2026-10-21)
- [x] Migração `family_shares` (`db/migrations/0004_family_shares.sql`; no máximo 10 partilhas por conta, até 1,5 MB cada)
- [x] Convite por ligação, com âmbito: garantias, SNS, cartas ou pós-óbito. Quem recebe não precisa de conta; quem partilha precisa de conta
- [x] Partilha cifrada ponta a ponta: chave AES-GCM aleatória que só existe na ligação, depois do `#` (nunca chega ao servidor); id e tema ligados ao texto cifrado
- [x] Revogação de acesso: apaga no servidor; os dados desaparecem do dispositivo de quem recebeu quando abre a app. As partilhas criadas noutro telemóvel também se podem retirar
- [x] Atualização ao abrir a app (sem tempo real): quem partilha envia só se os dados mudaram; quem recebe usa um pedido condicional (`If-None-Match`)
- [x] Botão "Enviar por WhatsApp" no convite, como no Poder e Beleza (`apps/web/src/share/whatsapp.ts`): abre o WhatsApp com a mensagem e a ligação já escritas, sem número, para a pessoa escolher o familiar; no computador pergunta uma vez se abre a app ou o WhatsApp Web

### Fase 9 — Lançamento (0,5 sem, em paralelo a partir da fase 5)

- [x] Política de privacidade e termos em português claro (`docs/privacidade.md`, `docs/termos.md`, na app em `/privacidade` e `/termos`)
- [x] Aviso legal revisto (Lei 49/2004): `docs/aviso-legal.md`, em `/aviso-legal` e com ligação no aviso de cada página
- [ ] Verificar o nome "Prazómetro" no INPI e no EUIPO (uma pesquisa na web a 2026-10-21 não encontrou marca nem produto com este nome; falta a consulta oficial nas bases, que tem de ser feita pelo autor)
- [x] Decidir domínio: fica `app.prazometro.workers.dev` (gratuito). Um domínio pago fica para decisão futura (secção 9)
- [x] Página de apresentação com exemplos (`/sobre`; as datas são calculadas pelo motor, com as regras reais)
- [ ] Publicação no LinkedIn e em grupos de consumidores e seniores (rascunhos em `docs/lancamento.md`; publica o autor)
- [x] Recolha de feedback na própria app (sem dados pessoais): `/opiniao`, guardada como relato `opiniao.<tema>` e lida no painel de admin

## 7. Calendário indicativo

| Semana | Fases                                           |
| ------ | ----------------------------------------------- |
| 1      | 0 e início da 1                                 |
| 2      | 1                                               |
| 3      | 2 (Garantia) — primeira versão utilizável       |
| 4      | 3 (SNS)                                         |
| 5      | 4 (Contas e cópia)                              |
| 6      | 5 (Admin e monitorização) e 9 (lançamento beta) |
| 7–8    | 6 (Cartas com IA)                               |
| 9–10   | 7 (Pós-óbito), dependente da revisão jurídica   |
| depois | 8 (Partilha), se houver procura                 |

## 8. Riscos

| Risco                                         | Impacto | Mitigação                                                                  |
| --------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| Regra errada ou desatualizada                 | Alto    | Fonte e data em cada regra, alerta aos 6 meses, botão para relatar, testes |
| Fronteira com aconselhamento jurídico         | Alto    | Só informação geral e modelos; aviso legal; validar com jurista            |
| Quota gratuita de IA cortada                  | Médio   | Chave própria (Gemini ou Claude) e modo sem IA sempre disponível           |
| Limites do D1 ou dos Workers                  | Médio   | Local-first, monitorização, alertas e modo poupança                        |
| Perda de dados ao mudar de telemóvel          | Médio   | Exportação local desde a fase 2; cópia cifrada na fase 4                   |
| OCR fraco em fotos más                        | Médio   | Pré-processamento, guia de captura e correção manual do texto              |
| Mudança das condições gratuitas da Cloudflare | Baixo   | Arquitetura simples, portável para o servidor Hetzner (FastAPI + SQLite)   |

## 9. Decisões em aberto

- [ ] Família a editar em conjunto (por exemplo, irmãos no mesmo processo de pós-óbito), cifrado ponta a ponta com uma chave de grupo. Só depois de validar a partilha atual em dois telemóveis e de haver pedidos
- [x] Confirmar se o D1 permite jurisdição UE ou só indicação de localização: permite (`--jurisdiction eu`), base criada assim em 2026-10-20
- [x] Escolher biblioteca de passkeys: SimpleWebAuthn (servidor 14.0.3 e navegador 14.0.0), em 2026-10-20
- [ ] Encontrar jurista para rever as fases 2, 3 e 7
- [ ] Decidir se o módulo de garantia importa compras do Faturómetro
- [ ] Decidir se as fotografias das faturas entram nas partilhas familiares (adiado para outra fase; hoje ficam de fora, para cada partilha caber em 1,5 MB no D1)
- [ ] Domínio pago (por exemplo, `prazometro.pt`): adiado; por agora fica `app.prazometro.workers.dev`, que é gratuito
- [x] Definir o limite diário de IA (2026-11-13): na IA gratuita, 10 leituras por dispositivo e por dia, sem conta, mais o teto de neurons. O `gemini-admin` mantém 10 por conta e 200 no total, se for ligado

## 10. Por validar (pelo autor, antes de dar as fases por concluídas)

Feito e testado com dados fictícios, mas à espera de confirmação com uso real ou de decisão.

Fase 5 (admin e monitorização)

- [x] Pôr o id da conta no segredo `ADMIN_IDS`, abrir `/admin` com a passkey e confirmar os números e os alertas (2026-11-13: o painel abre em produção e o monitor grava todas as métricas desde 2026-10-21, sem falhas; sem alertas porque o uso está muito abaixo dos 70%; os alertas só foram testados com dados simulados)
- [ ] Ativar o CallMeBot no WhatsApp do admin, pôr os segredos `WHATSAPP_PHONE` e `WHATSAPP_APIKEY` no Worker `monitor` e receber uma mensagem de teste (canal escolhido a 2026-11-13: WhatsApp). **2026-11-13: a mensagem de ativação para +34 644 26 33 77 ficou sem resposta.** Segundo o CallMeBot, tentar de novo uma só vez depois de 24 horas (a partir de 2026-11-14); suporte no Telegram `@callmebot_com`. Se voltar a falhar, implementar o Web Push (fase 5) e retirar o CallMeBot

Fase 6 (cartas explicadas)

- [ ] Ler uma carta com uma chave verdadeira da Gemini e da Claude (só foi testado o modo sem IA e uma chave falsa)
- [ ] Ler cartas e PDF verdadeiros (fotografia, PDF digital e PDF digitalizado) e ver se o texto e as datas saem certos
- [ ] Juntar cartas reais anonimizadas ao conjunto de teste (hoje são 30 fictícias)
- [ ] Rever as 3 regras de `rules/cartas/` e os textos "O que pode fazer" (`apps/web/src/modules/cartas/guidance.ts`) com um jurista
- [x] Decidir sobre o `gemini-admin` (2026-11-13): substituído pela IA gratuita com Workers AI; o código fica, desligado
- [x] Confirmar se os termos da Google permitem o `gemini-own` na UE (2026-11-13, termos da Gemini API em vigor desde 2026-03-23, https://aistudio.google.com/docs/terms): "You may use only Paid Services when making API Clients available to users in the European Economic Area", e o acesso só é pago com um projeto Google Cloud com faturação ativa. O `gemini-own` fica, mas só com chave de faturação ativa: o ecrã da chave avisa que a chave gratuita do AI Studio não serve. (O Validómetro diz "tem um plano gratuito" no Gemini: rever lá também)
- [x] Medir a IA gratuita com as 30 cartas fictícias (2026-11-13, Workers AI verdadeiro): emissor 30/30, datas 30/30, tipo 27/30 (trocou audiência da Segurança Social por "outro", PERSI por "cobrança" e uma fatura da água por "liquidação de imposto"), nenhuma data inventada; 11 a 15 neurons por carta (média 13), cerca de 700 cartas por dia nos 9 000 neurons; 2 a 6 segundos por carta (raramente mais)
- [ ] Ler cartas verdadeiras com a IA gratuita em produção e confirmar o acerto e o gasto de neurons no painel

Fase 7 (pós-óbito, aberto com o aviso "Em desenvolvimento")

- [ ] Percorrer o fluxo: criar processo, marcar passos, inventário e as 3 cartas
- [ ] Rever as 6 regras e as divergências de `docs/pos-obito-revisao.md` com um jurista
- [ ] Confirmar os textos sem fonte oficial direta (Banco de Portugal, ASF, art. 2071.º) e decidir sobre o IRS do ano do óbito, o testamento e os veículos
- [ ] Testar o tom e a linguagem com 3 famílias que passaram pelo processo
- [ ] Depois da revisão: passar as regras e as cartas a `"publicada"`, tirar `inDevelopment` em `apps/web/src/modules.ts` e o `DevelopmentBanner` das páginas do módulo

Fase 9 (lançamento)

- [ ] Ler a política de privacidade, os termos e o aviso legal (de preferência com o jurista)
- [ ] Consultar o nome "Prazómetro" nas bases do INPI (https://servicosonline.inpi.justica.gov.pt) e do EUIPO (https://www.tmdn.org/tmview)
- [ ] Rever os rascunhos de `docs/lancamento.md` e publicar

Fase 8 (partilha familiar)

- [ ] Partilhar a partir de um telemóvel com conta e abrir a ligação noutro telemóvel (por exemplo, por WhatsApp)
- [ ] Confirmar que uma alteração aparece no outro telemóvel depois de abrir as duas apps, e que "Retirar o acesso" apaga os dados do outro lado
