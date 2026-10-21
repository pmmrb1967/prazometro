---
id: pos-obito.comunicacao-banco
modulo: pos-obito
titulo: Comunicar o falecimento a um banco
campos:
  - id: nome
    rotulo: O seu nome
  - id: morada
    rotulo: A sua morada
  - id: entidade_nome
    rotulo: Nome do banco
  - id: entidade_morada
    rotulo: Morada do banco ou da agência
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
    rotulo: A sua relação com a pessoa (por exemplo, filha e cabeça de casal)
fontes:
  - titulo: Código Civil
    url: https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075
    artigo: 2079.º e 2080.º (administração da herança pelo cabeça de casal)
  - titulo: Código do Imposto do Selo
    url: https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/selo/Pages/selo26.aspx
    artigo: 26.º (participação e relação de bens)
verificado_em: 2026-10-21
verificado_por: Claude (assistente de IA); falta revisão por jurista
estado: a_rever
---
{{nome}}
{{morada}}

{{entidade_nome}}
{{entidade_morada}}

{{local}}, {{data_carta}}

## Assunto: Comunicação de falecimento e pedido de informação

Exmos. Senhores,

Venho comunicar o falecimento de {{falecido_nome}}, NIF {{falecido_nif}}, ocorrido no dia {{data_obito}}, vosso cliente. Escrevo na qualidade de {{qualidade}}. Junto cópia da certidão de óbito e do meu documento de identificação.

Para a participação do óbito às Finanças e para a partilha da herança, peço que me enviem:

1. A lista de todas as contas, depósitos, aplicações, créditos e cofres em nome de {{falecido_nome}}, ou de que fosse cotitular.
2. Uma declaração com os saldos e valores de cada produto à data do óbito.
3. A indicação dos seguros associados a créditos ou a contas, se existirem.

Peço também que me informem dos documentos de que precisam para os passos seguintes.

Com os melhores cumprimentos,

{{nome}}
