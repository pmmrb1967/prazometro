---
id: pos-obito.comunicacao-seguradora
modulo: pos-obito
titulo: Comunicar o falecimento a uma seguradora
campos:
  - id: nome
    rotulo: O seu nome
  - id: morada
    rotulo: A sua morada
  - id: entidade_nome
    rotulo: Nome da seguradora
  - id: entidade_morada
    rotulo: Morada da seguradora
  - id: local
    rotulo: Localidade
  - id: data_carta
    rotulo: Data da carta
  - id: falecido_nome
    rotulo: Nome da pessoa que faleceu
  - id: falecido_nif
    rotulo: NIF da pessoa que faleceu
  - id: data_obito
    rotulo: Data do óbito
  - id: qualidade
    rotulo: A sua relação com a pessoa (por exemplo, cônjuge e beneficiário)
fontes:
  - titulo: Código Civil
    url: https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075
    artigo: 2079.º e 2080.º (administração da herança pelo cabeça de casal)
  - titulo: Decreto-Lei n.º 384/2007, de 19 de novembro
    url: https://diariodarepublica.pt/dr/detalhe/decreto-lei/384-2007-628369
    artigo: Informação aos beneficiários de seguros de vida e de acidentes pessoais
verificado_em: 2026-10-21
verificado_por: Claude (assistente de IA); falta revisão por jurista
estado: a_rever
---
{{nome}}
{{morada}}

{{entidade_nome}}
{{entidade_morada}}

{{local}}, {{data_carta}}

## Assunto: Comunicação de falecimento e pedido de informação sobre seguros

Exmos. Senhores,

Venho comunicar o falecimento de {{falecido_nome}}, NIF {{falecido_nif}}, ocorrido no dia {{data_obito}}. Escrevo na qualidade de {{qualidade}}. Junto cópia da certidão de óbito e do meu documento de identificação.

Peço que me informem:

1. Dos contratos de seguro em que {{falecido_nome}} era tomador do seguro, pessoa segura ou beneficiário, incluindo seguros de vida, de acidentes pessoais e associados a créditos.
2. Dos capitais ou valores a pagar em consequência do óbito.
3. Dos documentos necessários para participar o sinistro e receber esses valores.

Peço ainda que os seguros que deixam de fazer sentido sejam cancelados, com a devolução dos prémios pagos a mais, se for o caso.

Com os melhores cumprimentos,

{{nome}}
