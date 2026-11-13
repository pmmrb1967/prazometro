# Prazómetro

PWA gratuita, em português europeu, que transforma direitos e burocracia em **prazos claros e ações concretas**: até quando se pode agir, o que fazer e a carta necessária.

**Experimentar online:** <https://app.prazometro.workers.dev> (no telemóvel ou no computador, abra o endereço e toque em **Instalar**).

Pensada para pessoas com mais de 65 anos, imigrantes e famílias: letra grande, alto contraste, linguagem simples e sem conta obrigatória.

## O que faz

| Módulo                       | Para quê                                                                                                           | Estado                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **Garantia de uma compra**   | Registar a compra, receber lembretes antes do fim da garantia legal de 3 anos e gerar a carta de reclamação        | Disponível                                       |
| **Espera no SNS**            | Ver se a espera por uma consulta ou cirurgia já passou o tempo máximo de resposta garantido (TMRG) e gerar a carta | Disponível                                       |
| **Perceber uma carta**       | Fotografar uma carta oficial e ver, em palavras simples, quem a enviou, o que pede e até quando                    | Disponível, com IA gratuita opcional             |
| **Depois de um falecimento** | Os passos, prazos e custos a tratar, por ordem, com as cartas necessárias                                          | Em desenvolvimento, à espera de revisão jurídica |

Os lembretes vão para o calendário do telemóvel (ficheiro `.ics`) e as cartas são geradas em PDF no próprio dispositivo.

## Como garante que os prazos estão certos

- **O motor de regras calcula, a IA só lê.** Prazos, elegibilidade e custos saem sempre de um motor determinístico ([`packages/engine`](packages/engine)), com testes. A IA, quando usada, só extrai campos e resume texto: nunca calcula um prazo nem decide um direito.
- **Cada regra tem fonte e data.** Todas as regras e modelos de carta indicam a fonte legal, com ligação, e a data da última verificação. As que passam 6 meses sem verificação aparecem como "a verificar".
- **Contagem segundo a lei.** Os prazos seguem o art. 279.º do Código Civil e os feriados nacionais do art. 234.º do Código do Trabalho, incluindo os móveis. Na dúvida, o motor dá sempre a data mais cedo.

> **Aviso legal.** O Prazómetro dá informação geral e modelos de carta. Não é aconselhamento jurídico nem substitui um advogado ou solicitador (Lei n.º 49/2004). Ver [`docs/aviso-legal.md`](docs/aviso-legal.md).

## Privacidade

- **Os dados ficam no dispositivo** (IndexedDB). Compras, cartas e dados de saúde nunca chegam ao servidor em claro.
- **Sem conta obrigatória.** A conta, opcional, serve só para cópias de segurança **cifradas no dispositivo** e entra com passkey, sem palavra-passe.
- **Antes de qualquer envio para a IA**, o texto é anonimizado no dispositivo (NIF, NISS, nomes, moradas, IBAN, números de processo).
- Os dados da base de dados ficam guardados só na União Europeia.

## Experimentar no computador

Requisitos: Node 22 ou superior. Depois de clonar:

```bash
npm install
npm run dev                  # http://localhost:5173, recarrega ao editar
```

Para testar a API ao mesmo tempo, noutro terminal (o `npm run dev` encaminha `/api` para aqui):

```bash
npx wrangler dev -c workers/api/wrangler.jsonc
```

### Verificações

```bash
npm run lint && npm run typecheck && npm test && npm run validate:rules
```

## Estrutura

```
apps/web/          PWA (React, Vite, vite-plugin-pwa)
workers/api/       Worker "app": serve a PWA e a API Hono em /api
packages/engine/   motor de regras: datas, feriados, prazos, condições, cartas em PDF, .ics
packages/ai/       fornecedores de IA (nenhum, gratuita com Workers AI, Gemini, Claude)
rules/             regras em JSON, uma pasta por módulo, validadas por rules/schema/
templates/         modelos de carta em Markdown com {{campos}}
db/migrations/     migrações da base D1
docs/              aviso legal, privacidade e decisões
planning/plan.md   plano, fases e tarefas
```

Regras do projeto (princípios, formato das regras, limites do plano gratuito) em [`CLAUDE.md`](CLAUDE.md). Estado e próximas fases em [`planning/plan.md`](planning/plan.md).

## Publicar

Corre só no plano gratuito da Cloudflare: Workers (com static assets) e D1, sem serviços pagos.

Cada push para `main` corre as verificações no GitHub Actions e, se passarem, aplica as migrações da D1 e publica em <https://app.prazometro.workers.dev>. À mão, com `CLOUDFLARE_API_TOKEN` no ficheiro `.env`:

```bash
npm run deploy               # build da PWA + publicação do Worker
```

## Licença

© 2026 Paulo Barbosa. Código aberto, com a licença [GNU Affero General Public License v3.0 ou posterior](LICENSE) (AGPL-3.0-or-later): pode usar, estudar, alterar e redistribuir o código, e quem disponibilizar uma versão alterada como serviço na internet tem de publicar também o código dessa versão.
