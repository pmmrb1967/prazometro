---
id: pos-obito.cancelamento-contrato
modulo: pos-obito
titulo: Cancelar um contrato da pessoa que faleceu
campos:
  - id: nome
    rotulo: O seu nome
  - id: morada
    rotulo: A sua morada
  - id: entidade_nome
    rotulo: Nome da empresa
  - id: entidade_morada
    rotulo: Morada da empresa
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
    rotulo: A sua relação com a pessoa (por exemplo, filho e cabeça de casal)
  - id: contrato
    rotulo: Serviço e número de cliente ou de contrato (por exemplo, telemóvel, cliente n.º 123)
  - id: pedido
    rotulo: O que pede
fontes:
  - titulo: Código Civil
    url: https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075
    artigo: 2079.º e 2080.º (administração da herança pelo cabeça de casal)
verificado_em: 2026-10-21
verificado_por: Claude (assistente de IA); falta revisão por jurista
estado: a_rever
---
{{nome}}
{{morada}}

{{entidade_nome}}
{{entidade_morada}}

{{local}}, {{data_carta}}

## Assunto: Falecimento do titular - {{contrato}}

Exmos. Senhores,

Venho comunicar o falecimento de {{falecido_nome}}, NIF {{falecido_nif}}, ocorrido no dia {{data_obito}}, titular do seguinte contrato: {{contrato}}. Escrevo na qualidade de {{qualidade}}. Junto cópia da certidão de óbito e do meu documento de identificação.

{{pedido}}

Peço que me enviem a confirmação por escrito, com a data de fim do contrato e a indicação de eventuais valores em dívida ou a devolver até essa data. Peço também que cancelem os débitos diretos associados a este contrato depois do último pagamento.

Com os melhores cumprimentos,

{{nome}}
