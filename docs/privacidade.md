# Política de privacidade

Última atualização: 21 de outubro de 2026.

O Prazómetro é uma aplicação gratuita e sem fins comerciais. Foi feita para guardar o mínimo possível sobre si. Este texto explica, em linguagem simples, que dados existem, onde ficam e o que pode fazer.

## Em resumo

- **Os seus dados ficam no seu telemóvel ou computador.** Compras, faturas, pedidos no SNS, cartas e processos ficam guardados no navegador (IndexedDB) e não são enviados para nós.
- **Não precisa de conta.** A conta só serve para a cópia na nuvem e para a partilha com a família.
- **Na nuvem, tudo vai cifrado.** A cópia de segurança e as partilhas são cifradas no seu dispositivo antes de saírem. O servidor guarda um ficheiro ilegível e não tem a chave.
- **Não há publicidade, nem rastreadores, nem venda de dados.**

## Que dados existem e onde ficam

### No seu dispositivo

Tudo o que escreve ou fotografa na app: compras e faturas, pedidos no SNS, cartas e o texto lido delas, processos depois de um falecimento, o seu nome e morada (se os guardar para as cartas) e as chaves de IA que indicar (cifradas). As fotografias e os PDF das cartas são lidos no próprio dispositivo (OCR) e não são enviados.

Pode apagar estes dados a qualquer momento: em cada item, ou apagando os dados do site nas definições do navegador.

### No servidor, só se criar uma conta

| Dado                                                                   | Para quê                             | Durante quanto tempo                       |
| ---------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| Identificador aleatório da conta e datas de criação e de último acesso | Saber que a conta existe             | Enquanto a conta existir                   |
| Chave pública da passkey                                               | Entrar sem palavra-passe             | Enquanto a conta existir                   |
| Verificador do código de recuperação (não serve para decifrar nada)    | Entrar com o código                  | Enquanto a conta existir                   |
| Chave das cópias, cifrada com a passkey ou com o código                | Recuperar a cópia noutro dispositivo | Enquanto a conta existir                   |
| Cópia de segurança cifrada                                             | Recuperar os dados                   | Até criar uma nova cópia ou apagar a conta |
| Partilhas com a família, cifradas                                      | Um familiar ver os seus prazos       | Até retirar o acesso ou apagar a conta     |
| Sessão (num cookie)                                                    | Manter a sessão aberta               | 90 dias                                    |

A conta não pede email, nome, telefone nem NIF.

### Sem conta

- **Avisos de regras desatualizadas e opiniões sobre a app:** guarda-se só o texto que escrever e a data, sem identificar quem escreveu. Pedimos que não escreva dados pessoais.
- **Estatísticas:** contamos totais por dia (número de pedidos ao servidor, contas e partilhas), para não ultrapassar os limites gratuitos. Nunca por pessoa.

## Inteligência artificial

Por defeito, a app lê as cartas **sem IA**, só no seu dispositivo. Se escolher usar a sua própria chave da Google (Gemini) ou da Anthropic (Claude):

- antes de enviar, a app retira nomes, moradas, NIF, NISS, IBAN, números de processo e outros identificadores, e mostra-lhe o texto exato que vai sair;
- o texto vai diretamente do seu dispositivo para essa empresa, ao abrigo do contrato entre si e ela. Não passa pelo nosso servidor;
- a IA só resume a carta. Os prazos são sempre calculados pelas regras da app.

## Quem trata os dados no nosso lugar

O serviço está alojado na **Cloudflare** (plano gratuito). A base de dados está guardada na União Europeia. Como qualquer serviço na internet, a Cloudflare regista dados técnicos dos pedidos (por exemplo, o endereço IP e a hora) para segurança e funcionamento, durante poucos dias. Não usamos esses registos para identificar pessoas.

## Cookies e armazenamento

Há um único cookie, só para quem tem conta, que mantém a sessão aberta. É estritamente necessário e não serve para publicidade. A app guarda no navegador as suas preferências (tamanho da letra, contraste e se já instalou a app). Não há cookies de terceiros.

## Os seus direitos

Ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD), pode pedir acesso, retificação ou apagamento dos seus dados. Na prática:

- os dados do dispositivo estão sempre consigo e pode exportá-los ou apagá-los na app;
- para apagar a conta e tudo o que está no servidor, use **A minha conta > Apagar a conta e as cópias na nuvem**. Também apaga as partilhas com a família. O apagamento é imediato;
- para qualquer dúvida, escreva para Prazometro@outlook.com.

Tem também o direito de apresentar queixa à Comissão Nacional de Proteção de Dados (CNPD, www.cnpd.pt).

## Alterações

Se esta política mudar, a data no topo é atualizada e as mudanças importantes são anunciadas na app.
