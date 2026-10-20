# CLAUDE.md — Prazómetro

Guia para o Claude Code trabalhar neste repositório. Ler antes de qualquer alteração.
O plano completo, com fases e tarefas, está em `planning/plan.md`.

## O que é

O **Prazómetro** é uma PWA gratuita, em português europeu, que ajuda qualquer pessoa a perceber e a cumprir prazos e direitos do dia a dia:

1. **Garantia de 3 anos**: registo da compra, alertas e carta de reclamação.
2. **Espera no SNS**: calcula se o tempo máximo de resposta garantido (TMRG) foi ultrapassado e gera a carta.
3. **Cartas explicadas**: foto de uma carta oficial, resumo simples, prazo e o que fazer.
4. **Pós-óbito e heranças**: checklist com prazos, custos e cartas.

Público principal: pessoas 65+, imigrantes e famílias. Projeto não comercial, do mesmo autor do Faturómetro.

## Princípios inegociáveis

1. **O motor de regras calcula, a IA só lê.** Prazos, elegibilidade e custos saem sempre do motor determinístico (`packages/engine`). A IA só extrai campos e resume texto. Nunca usar um LLM para calcular um prazo ou decidir um direito.
2. **Local-first.** Os dados do utilizador vivem no dispositivo (IndexedDB). O servidor guarda apenas contas, cópias de segurança **cifradas no cliente**, partilhas e estatísticas agregadas. O servidor nunca vê faturas, cartas ou dados de saúde em claro.
3. **Custo zero.** Só Cloudflare no plano gratuito: Pages, Workers, D1, Cron Triggers e envio de email para endereços verificados. **Sem R2** (exige cartão). Sem serviços pagos.
4. **Cada regra tem fonte e data.** Todas as regras e modelos de carta indicam a fonte legal (com ligação) e a data da última verificação. Regras com mais de 6 meses sem verificação aparecem marcadas como "a verificar".
5. **Informação, não aconselhamento jurídico.** A consulta jurídica é ato próprio de advogados e solicitadores (Lei 49/2004). Os textos dão informação geral e modelos, e nunca opinião sobre um caso concreto. O aviso legal tem de estar visível em todos os módulos.
6. **Acessível a 65+.** Letra grande, alto contraste, poucos passos, linguagem simples, sem conta obrigatória.
7. **Português europeu correto** em toda a interface, regras e cartas. Nada de português do Brasil ("você", "arquivo", "celular", "cadastro").

## Stack

| Camada        | Tecnologia                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| Frontend      | React + TypeScript + Vite, PWA (vite-plugin-pwa), alojado no Cloudflare Pages |
| Dados locais  | IndexedDB via Dexie                                                           |
| Validação     | zod (regras, respostas da IA, payloads da API)                                |
| PDF           | pdf-lib, gerado no dispositivo                                                |
| OCR           | Tesseract.js (`por`), no dispositivo                                          |
| Lembretes     | Exportação `.ics`                                                             |
| API           | Cloudflare Worker em TypeScript com Hono                                      |
| Base de dados | Cloudflare D1 (SQLite)                                                        |
| Monitorização | Worker com Cron Trigger, GraphQL Analytics API, `send_email` binding          |
| Autenticação  | Passkeys (WebAuthn) com código de recuperação                                 |
| Testes        | Vitest (motor e Worker), Playwright (fluxos principais)                       |

## Estrutura

```
prazometro/
├── CLAUDE.md
├── planning/plan.md          # plano, fases e tarefas
├── apps/web/                 # PWA React
│   └── src/modules/          # garantia, sns, cartas, pos-obito, admin
├── workers/api/              # Hono: auth, backup, ai-proxy, admin, partilha
├── workers/monitor/          # Cron: lê métricas, grava uso diário, envia alertas
├── packages/engine/          # motor de regras, prazos, feriados (sem dependências de UI)
├── packages/ai/              # camada de fornecedores de IA (none, gemini, claude)
├── rules/                    # regras em JSON, uma pasta por módulo
│   └── schema/               # esquema zod e JSON Schema das regras
├── templates/                # modelos de carta (Markdown com campos {{campo}})
├── db/migrations/            # SQL das migrações D1
└── docs/                     # aviso legal, privacidade, decisões
```

## Regras (formato)

Cada ficheiro em `rules/<modulo>/` é validado pelo esquema em `rules/schema/`. Campos obrigatórios:

- `id`, `modulo`, `titulo`, `descricao` (linguagem simples)
- `condicoes` (expressões avaliadas pelo motor)
- `prazo`: `{ "quantidade": n, "unidade": "dias|meses|anos", "contagem": "corridos|uteis", "transita_dia_util": true|false }`
- `fontes`: lista de `{ "titulo", "url", "artigo" }`
- `verificado_em` (AAAA-MM-DD) e `verificado_por`
- `modelos_carta` (ids em `templates/`)

Nunca escrever uma regra sem fonte. Se as fontes divergem, registar a divergência em `notas` e marcar `estado: "a_rever"`.

## Comandos

```bash
npm install                      # instalar dependências (workspaces)
npm run dev                      # PWA em desenvolvimento
npm run test                     # todos os testes (Vitest)
npm run test:engine              # testes do motor
npm run validate:rules           # valida todas as regras contra o esquema
npm run lint                     # ESLint
npm run typecheck                # TypeScript em todos os pacotes
npm run build                    # build da PWA (gera também os ícones a partir de apps/web/public/logo.svg)
npx wrangler dev -c workers/api/wrangler.jsonc
npx wrangler d1 migrations apply prazometro --local
npx wrangler deploy -c workers/api/wrangler.jsonc
```

O Wrangler autentica-se com `CLOUDFLARE_API_TOKEN`, definido no `.env` da raiz (fora do Git). O token pertence à conta Cloudflare do Prazómetro (Prazometro@outlook.com), nunca à do Faturómetro. A base D1 foi criada com `--jurisdiction eu`. API publicada: https://prazometro-api.prazometro-api.workers.dev/health

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
- Ao chegar a 90% de um limite diário, o Worker entra em **modo poupança**: desliga o proxy de IA do admin e suspende as cópias de segurança até ao dia seguinte.

## IA

- Fornecedores: `none` (palavras-chave), `gemini-admin` (chave do admin via Worker, com limite por utilizador), `gemini-own` e `claude-own` (chave do utilizador, chamada direta do navegador).
- Para a Claude Platform, a chamada direta do navegador usa o cabeçalho `anthropic-dangerous-direct-browser-access: true`. Só com a chave do próprio utilizador, nunca com a do admin.
- Modelo por defeito para a Claude: `claude-haiku-5-5` (configurável).
- Todos os fornecedores recebem o mesmo prompt e devolvem o mesmo esquema JSON, validado com zod. Se a validação falhar, volta ao modo `none`.
- **Anonimizar no dispositivo antes de enviar** (NIF, NISS, nomes, moradas, IBAN, números de processo).
- Chaves do utilizador guardadas só no dispositivo, cifradas com WebCrypto.

## O que nunca fazer

- Pôr a chave de IA do admin, o token da Cloudflare ou outros segredos no frontend.
- Registar em logs dados pessoais, texto de cartas ou conteúdo de faturas.
- Deixar o LLM decidir prazos, montantes ou elegibilidade.
- Publicar uma regra sem `fontes` e `verificado_em`.
- Publicar o módulo pós-óbito sem revisão por um jurista.
- Adicionar serviços que exijam cartão de crédito.
- Usar português do Brasil.

## Convenções

- Código e identificadores em inglês. Textos da interface, regras, cartas e documentação em português europeu.
- Commits curtos no imperativo, em português (`adiciona cálculo de dias úteis`).
- Qualquer alteração ao motor exige teste. Datas de prazos testadas com casos de feriados, fins de semana e fim de mês.
- Ao terminar uma tarefa do plano, marcar `[x]` em `planning/plan.md`.
