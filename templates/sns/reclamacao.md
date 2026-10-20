---
id: sns.reclamacao
modulo: sns
titulo: Reclamação por ultrapassar o tempo máximo de resposta
campos:
  - id: nome
    rotulo: O seu nome
  - id: morada
    rotulo: A sua morada
  - id: numero_utente
    rotulo: Número de utente do SNS
  - id: instituicao
    rotulo: Hospital ou centro de saúde
  - id: local
    rotulo: Localidade
  - id: data_carta
    rotulo: Data da carta
  - id: cuidado
    rotulo: O que está à espera (por exemplo, primeira consulta de Ortopedia)
  - id: data_inicio
    rotulo: Data do pedido ou da indicação do médico
  - id: tmrg
    rotulo: Tempo máximo de resposta garantido (por exemplo, 120 dias seguidos)
  - id: data_limite
    rotulo: Último dia do tempo máximo
  - id: situacao
    rotulo: A sua situação
fontes:
  - titulo: Portaria n.º 153/2017, de 4 de maio (versão consolidada)
    url: https://diariodarepublica.pt/dr/legislacao-consolidada/portaria/2017-953449980
    artigo: anexo I e anexo III (Carta dos Direitos de Acesso), parte I, n.os 5 e 6
  - titulo: Portaria n.º 135/2026/1, de 31 de março
    url: https://files.diariodarepublica.pt/1s/2026/03/06300/0000800019.pdf
    artigo: 3.º, n.º 1, alínea d), e n.º 3; 22.º (externalização)
verificado_em: 2026-10-20
verificado_por: Claude (assistente de IA), a partir do texto no Diário da República; falta revisão por jurista
estado: publicada
---
{{nome}}
{{morada}}
Número de utente: {{numero_utente}}

Ao Gabinete do Cidadão
{{instituicao}}

{{local}}, {{data_carta}}

## Assunto: Reclamação - tempo máximo de resposta garantido ultrapassado

Exmos. Senhores,

Aguardo o seguinte cuidado de saúde: {{cuidado}}. O pedido ou a indicação médica tem a data de {{data_inicio}}.

O tempo máximo de resposta garantido aplicável, fixado no anexo I da Portaria n.º 153/2017, de 4 de maio, na redação da Portaria n.º 137/2026/1, de 1 de abril, é de {{tmrg}}, pelo que terminou em {{data_limite}}. {{situacao}}

A Carta dos Direitos de Acesso aos Cuidados de Saúde pelos Utentes do SNS (anexo III da mesma portaria) reconhece-me o direito ao cumprimento deste tempo máximo e o direito a reclamar quando não é cumprido.

Venho, por isso, apresentar reclamação, nos termos do artigo 3.º da Portaria n.º 135/2026/1, de 31 de março, e pedir:

1. A marcação, com a maior brevidade, do cuidado de saúde de que necessito;
2. Caso não seja possível, o encaminhamento para outra entidade prestadora com disponibilidade, nos termos do artigo 22.º da mesma portaria, que desde já aceito;
3. Uma resposta escrita, com o número de registo desta reclamação.

Reservo-me o direito de apresentar esta reclamação também à Entidade Reguladora da Saúde.

Com os melhores cumprimentos,

{{nome}}
