---
id: sns.pedido-informacao
modulo: sns
titulo: Pedido de informação sobre o tempo de espera
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
fontes:
  - titulo: Portaria n.º 153/2017, de 4 de maio (versão consolidada)
    url: https://diariodarepublica.pt/dr/legislacao-consolidada/portaria/2017-953449980
    artigo: 4.º e anexo III (Carta dos Direitos de Acesso), parte II
  - titulo: Portaria n.º 135/2026/1, de 31 de março
    url: https://files.diariodarepublica.pt/1s/2026/03/06300/0000800019.pdf
    artigo: 3.º, n.º 1, alínea a)
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

## Assunto: Pedido de informação sobre o tempo de espera

Exmos. Senhores,

Aguardo o seguinte cuidado de saúde: {{cuidado}}. O pedido ou a indicação médica tem a data de {{data_inicio}}.

Nos termos da Carta dos Direitos de Acesso aos Cuidados de Saúde pelos Utentes do SNS (anexo III da Portaria n.º 153/2017, de 4 de maio) e do artigo 3.º da Portaria n.º 135/2026/1, de 31 de março, venho pedir que me informem, por escrito:

1. Se o meu pedido está inscrito na lista de espera e em que data foi feita a inscrição;
2. A prioridade clínica atribuída e o tempo máximo de resposta garantido que se aplica ao meu caso;
3. A minha posição atual na lista de espera e a data prevista para ser atendido;
4. Caso não seja possível responder dentro do tempo máximo de resposta garantido, que alternativa me é assegurada, nomeadamente o encaminhamento para outra entidade do SNS ou do setor convencionado.

Agradeço a resposta para a morada indicada acima.

Com os melhores cumprimentos,

{{nome}}
