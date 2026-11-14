import { describe, expect, it } from 'vitest';
import { anonymize } from './anonymize';

// Documentos FICTÍCIOS que copiam o formato de documentos reais lidos por OCR (com o ruído
// típico: "|", ":" soltos, letras coladas, "@" lido como "C" ou "&"). Nomes, números e
// moradas são inventados.

const ATA = `Conservatória do Registo Civil Fictícia
Acta de tentativa de conciliação
Processo de Alimentos a filhos maiores ou emancipados nº 777/2021 |
Requerente:
Beatriz Leonor Quaresma Valadares, de nacionalidade portuguesa
Requerido: |
Henrique Tomás Fagundes da Silveira Valadares, de nacionalidade portuguesa
Outros intervenientes:
Conservador, Vítor Ernesto Albuquerque
Secretário, Iracema Godinho, Oficial de registos
Advogada, Leonor Sampaio Brito, Mandatária da requerente
1- O Requerido pagará à Requerente, a título de prestação alimentar a quantia de 150.00€ (
cento e cinquenta euros), mensais.
2 - A quantia será paga até ao dia oito de cada mês, para o IBAN PT50 0010 0000 2321 8120
00148.
Requerente: :
iMafalda Rute Quaresma Valadares, de nacionalidade portuguesa
mim, Vitor Ernesto Albuquerque, por competência própria.
Data: 26 de agosto de 2021
Assento de Nascimento nº 5985/2008 da Conservatória do Registo Civil Fictícia`;

const CITACAO = `f Es GASPAR NOGUEIRA BETTENCOURT CITAÇÃO PREVIA - 728º CPC
Agente de Execução PROCESSO: 3518/20.5T8LOU
Exequente(s): Banco Fictício S.A. e outros
- *RA123456789PT* *RAS59540499PT*
Data: 09-04-2021 Documento: Noo9vbxh4na Referência interna do processo: PEDel/19/2021
O valor em dívida é fixado provisoriamente em 11281.94 Euros, com honorários de 627.30 Euros.
o agente de execução GASPAR NOGUEIRA BETTENCOURT, cédula 2165, com domicilio
Exequente(s) Banco Fictício S.A. e outros, e Executado(s) Ricardo Jorge Paiva Lacerda e outros.
MANDATÁRIO
Nome: Joana Teixeira Vasconcelos Cédula: 56767L
Telefone: 217 241 745 Email: joanateixeiravasconcelos-56767LCadv.oa.pt
EXECUTADO
Nome/Designação: Luís Filipe Paiva Lacerda
Morada: Al Manuel Francisco Correia N 217 Rc/Esq
Email: geral&osae.pt
Valor da Execução: 10 256,31 €`;

const CERTIDAO = `Assento de Óbito n.º 706 do ano de 2024
Nome: Clotilde Amparo Fontoura *** :
Estado: Viúvo(a) Anselmo Brás Fontoura***
Naturalidade: freguesia de Vilarinho Fictício ***
Sepultado: No cemitério de Alvarenga Fictícia ***
Pai: Abílio Fontoura ***
Mãe: Engrácia Leal ***
Hora e data do - 07 horas e 00 minutos , do dia 24 de julho de 2024 ***
Declarante(s): Diana Coelho de Sousa, com residência habitual em Rua do Centro
Cultural, 172, Duas Igrejas ***
Data do assento: 25 de julho de 2024 ***
O/A Oficial de registos, Anabela Ferreira Quintas , Por competência própria`;

function leaks(texto: string, secrets: string[]) {
  return secrets.filter((s) => texto.toLowerCase().includes(s.toLowerCase()));
}

describe('anonimização de documentos reais (formatos)', () => {
  it('ata da conservatória: partes, conservador, secretário, advogada e IBAN partido', () => {
    const { texto } = anonymize(ATA);
    expect(
      leaks(texto, [
        'Beatriz',
        'Leonor',
        'Quaresma',
        'Valadares',
        'Henrique',
        'Fagundes',
        'Silveira',
        'Vítor',
        'Vitor',
        'Ernesto',
        'Albuquerque',
        'Iracema',
        'Godinho',
        'Sampaio',
        'Mafalda',
        'Rute',
        '00148',
        '777/2021',
        '5985/2008',
      ]),
    ).toEqual([]);
    // O que é preciso para perceber a carta fica.
    expect(texto).toContain('150.00€');
    expect(texto).toContain('26 de agosto de 2021');
    expect(texto).toContain('Conservatória do Registo Civil');
  });

  it('citação do agente de execução: nomes em maiúsculas, executados, emails mal lidos', () => {
    const { texto } = anonymize(CITACAO);
    expect(
      leaks(texto, [
        'GASPAR',
        'Nogueira',
        'Bettencourt',
        'Ricardo',
        'Lacerda',
        'Luís',
        'Joana',
        'Teixeira',
        'Vasconcelos',
        'joanateixeira',
        'Manuel Francisco',
        'osae.pt',
        '56767L',
        '2165',
        'RA123456789PT',
        'RAS59540499PT',
        'PEDel/19/2021',
        'Noo9vbxh4na',
      ]),
    ).toEqual([]);
    // Montantes ficam, com ponto ou vírgula decimal, e o credor (uma empresa) também.
    expect(texto).toContain('11281.94 Euros');
    expect(texto).toContain('627.30 Euros');
    expect(texto).toContain('256,31 €');
    expect(texto).toContain('Banco Fictício');
    expect(texto).toContain('728º CPC');
  });

  it('certidão de óbito: falecida, cônjuge, pais, declarante, oficial e residência', () => {
    const { texto } = anonymize(CERTIDAO);
    expect(
      leaks(texto, [
        'Clotilde',
        'Fontoura',
        'Anselmo',
        'Abílio',
        'Engrácia',
        'Diana',
        'Coelho',
        'Centro',
        'Duas Igrejas',
        'Anabela',
        'Quintas',
        'Vilarinho',
        'Alvarenga',
      ]),
    ).toEqual([]);
    expect(texto).toContain('24 de julho de 2024');
    expect(texto).toContain('25 de julho de 2024');
  });

  it('não apaga palavras comuns depois de um papel ("o Requerente e Requerido", "Juiz 2")', () => {
    const { texto } = anonymize(
      'Entre o Requerente e Requerido foi conseguido acordo. O Conservador deu por encerrada a diligência. Juízo de Execução - Juiz 2.',
    );
    expect(texto).toBe(
      'Entre o Requerente e Requerido foi conseguido acordo. O Conservador deu por encerrada a diligência. Juízo de Execução - Juiz 2.',
    );
  });
});
