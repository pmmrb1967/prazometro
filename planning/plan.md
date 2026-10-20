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
│ Pages: PWA + regras estáticas                                │
│ Worker api (Hono): passkeys, cópias, proxy IA admin,         │
│                    partilha familiar, painel admin           │
│ Worker monitor (Cron, de hora a hora): GraphQL Analytics,    │
│                    uso diário, alertas por email             │
│ D1: contas, cópias em blocos, partilhas, estatísticas        │
│ Email: send_email para o endereço verificado do admin        │
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
| Localização                | D1 com indicação de localização na Europa (confirmar opção de jurisdição UE)  | RGPD                                                                                                    |

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

### Fase 0 — Fundação (0,5 sem)

- [x] Criar repositório `pmmrb1967/prazometro` com npm workspaces (`apps`, `workers`, `packages`)
- [x] Configurar TypeScript, ESLint, Prettier e Vitest partilhados
- [x] PWA mínima (Vite + React + vite-plugin-pwa) com ecrã inicial e aviso legal
- [x] Base de acessibilidade: tamanho de letra ajustável, alto contraste, foco visível
- [ ] Projeto Cloudflare Pages ligado ao GitHub (deploy automático no `main`)
- [x] Worker `api` com Hono e rota `/health`
- [ ] Criar base D1 `prazometro` com localização na Europa e primeira migração vazia
- [x] GitHub Actions: lint, testes e `validate:rules` em cada push

**Concluída quando**: a PWA está publicada em `*.pages.dev`, instalável no telemóvel, e o Worker responde.

### Fase 1 — Motor de regras (1 sem)

- [ ] Esquema zod das regras e exportação para JSON Schema
- [ ] Script `validate:rules` (falha sem `fontes` ou `verificado_em`)
- [ ] Calendário de feriados nacionais, incluindo os móveis (Sexta-feira Santa, Páscoa, Corpo de Deus)
- [ ] Cálculo de prazos: dias corridos e úteis, meses e anos, fim de mês, transição para o dia útil seguinte
- [ ] Avaliador de condições das regras
- [ ] Marcos e alertas (por exemplo, 30 dias antes do fim do 2.º ano)
- [ ] Estado de verificação: marcar como "a verificar" as regras com mais de 6 meses
- [ ] Gerador de cartas: modelos Markdown com `{{campos}}` para PDF (pdf-lib)
- [ ] Exportação `.ics` com alarmes
- [ ] Testes: pelo menos 30 casos de datas (feriados, fins de semana, 29 de fevereiro, fim de mês)

**Concluída quando**: o motor calcula prazos de regras de exemplo com 100% dos testes a passar.

### Fase 2 — Módulo Garantia (1 sem)

- [ ] Recolher e validar as regras (bens novos, usados, reparação, substituição) com fontes
- [ ] Formulário de compra: produto, loja, data, novo ou usado, foto da fatura
- [ ] Lista de compras com estado da garantia (barra de tempo e próximos marcos)
- [ ] Exportação dos alertas para o calendário
- [ ] Fluxo de reclamação: carta à loja, Livro de Reclamações eletrónico, centro de arbitragem
- [ ] Modelos de carta: reclamação ao vendedor e pedido de reparação ou substituição
- [ ] Exportar e importar cópia de segurança local (ficheiro), antes de existir sincronização
- [ ] Teste com 5 pessoas reais, incluindo pelo menos 2 com mais de 65 anos

**Concluída quando**: uma pessoa regista uma compra, recebe o lembrete no calendário e gera a carta sem ajuda.

### Fase 3 — Módulo Espera no SNS (1 sem)

- [ ] Recolher a tabela de TMRG em vigor (portaria) com fonte e data
- [ ] Formulário: tipo, especialidade, prioridade e data do pedido
- [ ] Indicador "dentro do prazo" ou "prazo ultrapassado há X dias"
- [ ] Explicação dos direitos e dos passos seguintes
- [ ] Modelos de carta: pedido de informação e reclamação
- [ ] Testes com casos de cada nível de prioridade

**Concluída quando**: o cálculo coincide com 10 casos verificados manualmente na tabela oficial.

### Fase 4 — Contas e cópia de segurança (1 sem)

- [ ] Migrações D1: `users`, `passkeys`, `recovery_codes`, `backups`
- [ ] Registo e entrada com passkeys (WebAuthn) e códigos de recuperação
- [ ] Cifra no cliente: chave derivada (PBKDF2) e AES-GCM com WebCrypto
- [ ] Envio da cópia em blocos de 1,5 MB, com versão e verificação de integridade
- [ ] Restauro noutro dispositivo
- [ ] Opção de incluir fotos na cópia (comprimidas em WebP)
- [ ] Apagar conta e todos os dados (direito ao apagamento, RGPD)
- [ ] Testes de cópia e restauro com 1 MB, 5 MB e 20 MB

**Concluída quando**: um utilizador muda de telemóvel e recupera tudo, e o servidor só tem BLOBs cifrados.

### Fase 5 — Painel de admin e monitorização (1 sem)

- [ ] Migrações: `usage_daily`, `alerts_sent`, `ai_usage_daily`, `rule_reports`
- [ ] Worker `monitor` com Cron Trigger de hora a hora
- [ ] Leitura da GraphQL Analytics API (`d1AnalyticsAdaptiveGroups`, pedidos ao Worker) com token só de leitura
- [ ] Tamanho de cada base e da conta, comparado com 500 MB e 5 GB
- [ ] Email Routing ativo e endereço do admin verificado; binding `send_email`
- [ ] Alertas aos 70% e 90%, no máximo um por métrica, patamar e dia
- [ ] Modo poupança aos 90%: desliga o proxy de IA do admin e suspende cópias até às 00:00 UTC
- [ ] Rota `/admin` protegida (papel `admin` e passkey)
- [ ] Painel com gráficos dos últimos 30 dias: armazenamento, linhas lidas e escritas, pedidos, chamadas de IA, utilizadores ativos
- [ ] Lista de relatos "regra desatualizada" com estado
- [ ] Opcional: alerta também por bot de Telegram

**Concluída quando**: simulando 90% de uso, o admin recebe o email e o modo poupança liga-se e desliga-se sozinho.

### Fase 6 — Cartas explicadas com IA (2 sem)

- [ ] OCR no dispositivo com Tesseract.js (`por`), com pré-processamento (recorte, contraste, rotação)
- [ ] Anonimização: NIF, NISS, IBAN, nomes, moradas, números de processo e matrículas
- [ ] Pacote `packages/ai` com interface comum `extrair(texto) → JSON`
- [ ] Fornecedor `none`: identificação do emissor por palavras-chave (AT, Segurança Social, tribunais, bancos, operadoras, SNS)
- [ ] Fornecedor `gemini-admin` via Worker, com limite diário por utilizador
- [ ] Fornecedor `gemini-own`, com chamada direta do navegador
- [ ] Fornecedor `claude-own`, com chamada direta e cabeçalho `anthropic-dangerous-direct-browser-access`, modelo por defeito `claude-haiku-5-5`
- [ ] Ecrã de configuração: escolher fornecedor, colar a chave, "Testar chave" e contador local de uso
- [ ] Chaves guardadas cifradas no dispositivo
- [ ] Esquema JSON da resposta (emissor, assunto, datas, pedido, consequências) validado com zod
- [ ] Ligação ao motor: se a carta corresponder a uma regra, o prazo é calculado pelo motor e não pela IA
- [ ] Ecrã de resultado: quem enviou, o que pede, até quando, o que fazer, com aviso legal
- [ ] Conjunto de teste com 30 cartas reais anonimizadas e taxa de acerto do emissor e das datas

**Concluída quando**: acerto de pelo menos 90% no emissor e nas datas no conjunto de teste, e nenhum dado pessoal sai do dispositivo sem anonimização.

### Fase 7 — Pós-óbito e heranças (2 sem)

- [ ] Levantamento de passos, prazos e custos com fontes (registo, AT, Segurança Social, bancos, habilitação de herdeiros)
- [ ] Registar divergências entre fontes e resolvê-las com um jurista
- [ ] Checklist cronológica com estado por passo
- [ ] Inventário de bens (contas, imóveis, veículos, seguros, subscrições)
- [ ] Modelos de carta: cancelamento de contratos, comunicação a bancos e seguradoras
- [ ] **Revisão jurídica completa antes de publicar**
- [ ] Linguagem cuidada e tom sensível (testar com pessoas que passaram pelo processo)

**Concluída quando**: um jurista valida o conteúdo e 3 famílias testam o fluxo.

### Fase 8 — Partilha familiar (1–2 sem, opcional)

- [ ] Só avançar se houver pedidos de utilizadores
- [ ] Migração `family_shares`
- [ ] Convite por ligação ou código, com âmbito (por exemplo, só garantias ou só o processo pós-óbito)
- [ ] Partilha cifrada ponta a ponta (chave de partilha trocada entre dispositivos)
- [ ] Revogação de acesso
- [ ] Atualização ao abrir a app (sem tempo real)

### Fase 9 — Lançamento (0,5 sem, em paralelo a partir da fase 5)

- [ ] Política de privacidade e termos em português claro
- [ ] Aviso legal revisto (Lei 49/2004)
- [ ] Verificar o nome "Prazómetro" no INPI e no EUIPO
- [ ] Decidir domínio (`prazometro.pt` ou manter `pages.dev`)
- [ ] Página de apresentação com exemplos
- [ ] Publicação no LinkedIn e em grupos de consumidores e seniores
- [ ] Recolha de feedback na própria app (sem dados pessoais)

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

- [ ] Confirmar se o D1 permite jurisdição UE ou só indicação de localização
- [ ] Escolher biblioteca de passkeys (por exemplo, SimpleWebAuthn)
- [ ] Encontrar jurista para rever as fases 2, 3 e 7
- [ ] Decidir se o módulo de garantia importa compras do Faturómetro
- [ ] Definir o limite diário de chamadas de IA por utilizador com a chave do admin
