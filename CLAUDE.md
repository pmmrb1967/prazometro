# CLAUDE.md — Prazómetro

Guia para o Claude Code trabalhar neste repositório. Ler antes de qualquer alteração.
O plano completo, com fases e tarefas, está em `planning/plan.md`.

## O que é

O **Prazómetro** é uma PWA gratuita, em português europeu, que ajuda qualquer pessoa a perceber e a cumprir prazos e direitos do dia a dia:

1. **Garantia de 3 anos**: registo da compra, alertas e carta de reclamação.
2. **Espera no SNS**: calcula se o tempo máximo de resposta garantido (TMRG) foi ultrapassado e gera a carta.
3. **Cartas explicadas**: foto de uma carta oficial, resumo simples, prazo e o que fazer.
4. **Pós-óbito e heranças**: checklist com prazos, custos e cartas.

Público principal: pessoas 65+, imigrantes e famílias. Projeto não comercial, do mesmo autor do Faturómetro. Código aberto em https://github.com/pmmrb1967/prazometro (público), com a licença AGPL-3.0-or-later (`LICENSE`). O rodapé mostra © 2026 Paulo Barbosa, a versão (`apps/web/package.json`) e o commit do build; uma versão nova é anunciada por uma barra no topo (`apps/web/src/pwa.ts`), nunca aplicada sozinha.

## Princípios inegociáveis

1. **O motor de regras calcula, a IA só lê.** Prazos, elegibilidade e custos saem sempre do motor determinístico (`packages/engine`). A IA só extrai campos e resume texto. Nunca usar um LLM para calcular um prazo ou decidir um direito.
2. **Local-first.** Os dados do utilizador vivem no dispositivo (IndexedDB). O servidor guarda apenas contas, cópias de segurança **cifradas no cliente**, partilhas e estatísticas agregadas. O servidor nunca vê faturas, cartas ou dados de saúde em claro.
3. **Custo zero.** Só Cloudflare no plano gratuito: Workers (com static assets), D1, Cron Triggers e Workers AI (neurons gratuitos, para a IA gratuita das cartas). Alertas do admin por WhatsApp com o CallMeBot (gratuito para uso pessoal). **Sem R2** (exige cartão). Sem serviços pagos.
4. **Cada regra tem fonte e data.** Todas as regras e modelos de carta indicam a fonte legal (com ligação) e a data da última verificação. Regras com mais de 6 meses sem verificação aparecem marcadas como "a verificar".
5. **Informação, não aconselhamento jurídico.** A consulta jurídica é ato próprio de advogados e solicitadores (Lei 49/2004). Os textos dão informação geral e modelos, e nunca opinião sobre um caso concreto. O aviso legal tem de estar visível em todos os módulos.
6. **Acessível a 65+.** Letra grande, alto contraste, poucos passos, linguagem simples, sem conta obrigatória.
7. **Português europeu correto** em toda a interface, regras e cartas. Nada de português do Brasil ("você", "arquivo", "celular", "cadastro").

## Stack

| Camada        | Tecnologia                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Frontend      | React + TypeScript + Vite, PWA (vite-plugin-pwa), servida pelo Worker `app` (static assets) em app.prazometro.workers.dev |
| Dados locais  | IndexedDB via Dexie                                                                                                       |
| Validação     | zod (regras, respostas da IA, payloads da API)                                                                            |
| PDF           | pdf-lib, gerado no dispositivo                                                                                            |
| OCR           | Tesseract.js (`por`), no dispositivo                                                                                      |
| Lembretes     | Exportação `.ics`                                                                                                         |
| API           | Cloudflare Worker em TypeScript com Hono                                                                                  |
| Base de dados | Cloudflare D1 (SQLite)                                                                                                    |
| Monitorização | Worker com Cron Trigger, GraphQL Analytics API, alertas por WhatsApp (CallMeBot)                                          |
| Autenticação  | Passkeys (WebAuthn) com código de recuperação                                                                             |
| Testes        | Vitest (motor e Worker), Playwright (fluxos principais)                                                                   |

## Estrutura

```
prazometro/
├── CLAUDE.md
├── planning/plan.md          # plano, fases e tarefas
├── apps/web/                 # PWA React
│   └── src/modules/          # garantia, sns, cartas, pos-obito, admin
├── workers/api/              # Worker `app`: serve a PWA e a API Hono em /api (auth, backup, ai-proxy, admin, partilha)
├── workers/monitor/          # Cron: lê métricas, grava uso diário, envia alertas
├── packages/engine/          # motor de regras, prazos, feriados (sem dependências de UI)
├── packages/ai/              # camada de fornecedores de IA (none, workers-ai, gemini, claude)
├── rules/                    # regras em JSON, uma pasta por módulo
│   └── schema/               # esquema zod e JSON Schema das regras
├── templates/                # modelos de carta (Markdown com campos {{campo}})
├── db/migrations/            # SQL das migrações D1
└── docs/                     # aviso legal, privacidade, decisões
```

## Regras (formato)

Cada ficheiro em `rules/<modulo>/` é validado pelo esquema zod em `packages/engine/src/rules/schema.ts` (fonte única). O JSON Schema em `rules/schema/regra.schema.json` é gerado com `npm run schema:rules` e serve para o editor (`"$schema": "../schema/regra.schema.json"`). Campos obrigatórios:

- `id` (`modulo.nome-da-regra`), `modulo`, `titulo`, `descricao` (linguagem simples)
- `condicoes`: objeto em que cada chave é um campo dos factos e todas têm de se verificar. Valor simples = igualdade; ou operador `{ "em": [...] }`, `{ "nao_em": [...] }`, `{ "diferente": x }`, `{ "min": n }`, `{ "max": n }`, `{ "existe": true|false }`. A chave `qualquer` recebe uma lista de condições das quais basta uma
- `inicio`: nome do facto que dá a data de início do prazo (por exemplo `data_entrega` ou `data_comunicacao`). Se o facto faltar ou não for uma data válida, a regra não se aplica e `inicio` aparece nas falhas
- `prazo`: `{ "quantidade": n, "unidade": "dias|meses|anos", "contagem": "corridos|uteis", "transita_dia_util": true|false }`, com `transicao`, `fim_do_mes` (o prazo acaba no último dia do mês a que se chega, por exemplo "até ao final do 3.º mês seguinte"; só meses e anos) e `alertas_dias_antes` opcionais (ver abaixo)
- `fontes`: lista de `{ "titulo", "url" (https), "artigo" }`, com pelo menos uma
- `verificado_em` (AAAA-MM-DD, nunca no futuro) e `verificado_por`
- `modelos_carta` (ids que têm de existir em `templates/`)
- `estado`: `"publicada"` ou `"a_rever"`

Opcionais: `marcos` (`{ id, quantidade, unidade, alerta_dias_antes?, texto }`, datas de referência que não transitam para dia útil) e `notas`.

Contagem de prazos (Código Civil, art. 279.º): não se conta o dia do evento; meses e anos terminam no dia correspondente ou no último dia do mês. Com `transita_dia_util`, o fim passa para o dia útil seguinte **só se calhar em domingo ou feriado**: um sábado não transita no regime civil. Para prazos perante serviços ou tribunais fechados ao sábado (por exemplo, CPA art. 87.º ou CPC art. 138.º), indicar `"transicao": "sabado_domingo_feriado"`, depois de confirmar a fonte. "Oito dias" e "quinze dias" valem uma e duas semanas (art. 279.º, d)): escrever 7 e 14. Na dúvida, o motor dá sempre a data mais cedo.

Modelos de carta em `templates/<modulo>/*.md`: cabeçalho YAML entre `---` com `id`, `modulo`, `titulo`, `campos` (`{ id, rotulo, obrigatorio? }`), `fontes`, `verificado_em`, `verificado_por` e `estado`, seguido do corpo em Markdown com `{{campo}}`. Os campos usados e declarados têm de coincidir.

Nunca escrever uma regra sem fonte. Se as fontes divergem, registar a divergência em `notas` e marcar `estado: "a_rever"`. Os testes do motor usam só a regra fictícia de `packages/engine/src/rules/fixtures.ts`, que nunca pode ir para `rules/`.

## Comandos

```bash
npm install                      # instalar dependências (workspaces)
npm run dev                      # PWA em desenvolvimento
npm run test                     # todos os testes (Vitest)
npm run test:engine              # testes do motor
npm run validate:rules           # valida regras e modelos de carta (falha sem fontes ou verificado_em)
npm run schema:rules             # gera rules/schema/regra.schema.json a partir do esquema zod
npm run lint                     # ESLint
npm run typecheck                # TypeScript em todos os pacotes
npm run build                    # build da PWA (gera também os ícones a partir de apps/web/public/logo.svg)
npx wrangler dev -c workers/api/wrangler.jsonc
npx wrangler d1 migrations apply prazometro --local
npm run deploy                   # build da PWA + publicação do Worker app (PWA em /, API em /api)
npx wrangler dev -c workers/monitor/wrangler.jsonc --test-scheduled   # monitor local (/__scheduled corre o cron)
npx wrangler secret put CF_ANALYTICS_TOKEN -c workers/monitor/wrangler.jsonc   # token só com "Account Analytics: Read"
npx wrangler secret put WHATSAPP_PHONE -c workers/monitor/wrangler.jsonc   # número do admin com indicativo (+351…), para os alertas
npx wrangler secret put WHATSAPP_APIKEY -c workers/monitor/wrangler.jsonc  # chave do CallMeBot (ativação em callmebot.com/blog/free-api-whatsapp-messages)
npx wrangler secret put ADMIN_IDS -c workers/api/wrangler.jsonc   # contas de admin: ids separados por vírgulas (id em A minha conta > Detalhes técnicos)
npx wrangler secret put GEMINI_API_KEY -c workers/api/wrangler.jsonc   # chave do admin para o gemini-admin (só com AI_ADMIN = "ligado" nas vars; desligado por causa dos termos da Google na UE)
```

O `dev` e o `build` da PWA correm antes `scripts/copy-ocr-assets.mjs`, que copia o Tesseract.js e os dados `por` para `apps/web/public/ocr/` (fora do Git).

O Wrangler autentica-se com `CLOUDFLARE_API_TOKEN`, definido no `.env` da raiz (fora do Git). O token pertence à conta Cloudflare do Prazómetro (Prazometro@outlook.com), nunca à do Faturómetro. A base D1 foi criada com `--jurisdiction eu`. App publicada em https://app.prazometro.workers.dev (PWA servida como static assets) e API em https://app.prazometro.workers.dev/api/ (Worker `app`, subdomínio da conta `prazometro`). Todas as rotas da API ficam sob `/api`. O `main` é publicado automaticamente pela CI (migrações D1, Worker `app` e Worker `monitor`) se existir o segredo `CLOUDFLARE_API_TOKEN` no GitHub. O módulo pós-óbito está aberto a todos com o aviso "Em desenvolvimento" (`DevelopmentBanner`) em todas as páginas, até haver revisão jurídica (ver `docs/pos-obito-revisao.md`). A partilha familiar (`/partilhar`) cifra os dados no dispositivo com uma chave que só existe na ligação de convite, depois do `#`; o servidor (`/api/shares`) guarda só o texto cifrado. As páginas de privacidade, termos e aviso legal leem diretamente `docs/*.md` (alterar só lá). As opiniões de `/opiniao` vão para `/api/feedback` e aparecem no painel junto dos relatos de regras. A conta (opcional) está em `/conta` ("Entrar" na barra de topo; `/copia` reencaminha para lá): cópia na nuvem, partilha com a família e acesso. O painel de admin está em `/admin` e só abre para contas de admin (ids no segredo `ADMIN_IDS` ou, em alternativa, `role='admin'` na tabela `users`) com sessão aberta com passkey.

(Atualizar esta secção quando forem criados novos scripts.)

## Limites do plano gratuito (respeitar sempre)

| Recurso                | Limite                                                                       |
| ---------------------- | ---------------------------------------------------------------------------- |
| Workers                | 100 000 pedidos/dia, 10 ms de CPU por pedido                                 |
| D1                     | 10 bases, 500 MB por base, 5 GB por conta                                    |
| D1 leituras e escritas | 5 milhões de linhas lidas e 100 000 escritas por dia (reinicia às 00:00 UTC) |
| D1 por valor           | 2 MB por linha ou BLOB                                                       |
| D1 por invocação       | 50 consultas por pedido ao Worker                                            |

Consequências práticas:

- Usar índices em todas as colunas de filtro, porque cada linha percorrida conta como lida.
- Não gravar contadores por pedido. Agregar e escrever no máximo uma vez por hora.
- Não gerar PDFs nem fazer OCR no Worker (CPU). Tudo isso corre no dispositivo.
- Não usar bcrypt em JavaScript. Usar WebCrypto (PBKDF2, AES-GCM) ou passkeys.
- Cópias de segurança partidas em blocos de no máximo 1,5 MB.
- Ao chegar a 90% de um limite diário, o Worker entra em **modo poupança**: desliga a IA do Prazómetro (gratuita e do admin) e suspende as cópias de segurança até ao dia seguinte.

## IA

- Fornecedores: `workers-ai` (gratuita e por defeito: Workers AI via Worker em `/api/ai/gratuita`, sem chave nem conta, 10 leituras por dispositivo e por dia; por rede (endereço IP), 10 leituras por minuto (binding `ratelimits`, em memória) e 30 leituras ou 3 000 neurons por dia, para um script que invente identificadores não gastar a quota de todos; e uma reserva nos 10 000 neurons diários. O dispositivo é um identificador aleatório e o servidor guarda só `sha256(dia + id)`; a rede só `sha256(sal do dia + IP)` em `ai_free_address_daily`, com um sal aleatório em `settings` apagado no dia seguinte, com as linhas. O IP nunca se guarda), `none` (palavras-chave), `gemini-own` e `claude-own` (chave do utilizador, chamada direta do navegador) e `gemini-admin` (chave do admin via Worker, desligado por causa dos termos da Google na UE).
- Para a Claude Platform, a chamada direta do navegador usa o cabeçalho `anthropic-dangerous-direct-browser-access: true`. Só com a chave do próprio utilizador, nunca com a do admin.
- Modelo por defeito para a Claude: `claude-haiku-5-5` (configurável).
- Usos: ler cartas (`LETTER_TASK`) e preencher uma compra a partir da fatura (`INVOICE_TASK`, em `packages/ai/src/invoice.ts`), com a quota da IA gratuita partilhada. Na fatura, a data e o total da IA só valem se estiverem escritos no texto.
- Todos os fornecedores recebem o mesmo prompt e devolvem o mesmo esquema JSON para cada tarefa, validado com zod. Se a validação falhar, volta ao modo `none`.
- **Anonimizar no dispositivo antes de enviar** (NIF, NISS, nomes, moradas, IBAN, números de processo).
- Chaves do utilizador guardadas só no dispositivo, cifradas com WebCrypto.

## O que nunca fazer

- Pôr a chave de IA do admin, o token da Cloudflare ou outros segredos no frontend.
- Registar em logs dados pessoais, texto de cartas ou conteúdo de faturas.
- Deixar o LLM decidir prazos, montantes ou elegibilidade.
- Publicar uma regra sem `fontes` e `verificado_em`.
- Divulgar o módulo pós-óbito sem revisão por um jurista. Até lá, as regras ficam `a_rever` e todas as páginas do módulo mostram o aviso "Em desenvolvimento".
- Adicionar serviços que exijam cartão de crédito.
- Usar português do Brasil.

## Convenções

- Código e identificadores em inglês. Textos da interface, regras, cartas e documentação em português europeu.
- Commits curtos no imperativo, em português (`adiciona cálculo de dias úteis`).
- Qualquer alteração ao motor exige teste. Datas de prazos testadas com casos de feriados, fins de semana e fim de mês.
- Ao terminar uma tarefa do plano, marcar `[x]` em `planning/plan.md`.
