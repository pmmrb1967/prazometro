import { describe, expect, it } from 'vitest';
import { properName, readDeathCertificate } from './deathCertificate';

// Certidões FICTÍCIAS, com nomes e números inventados.

const ELETRONICA = `CERTIDÃO
Assento de Óbito n.º 1234 do ano de 2026
Conservatória do Registo Civil de Lisboa
Nome: MARIA DA CONCEIÇÃO FICTÍCIA SANTOS
Sexo: Feminino   Idade: 82 anos
Data de nascimento: 1944-05-02
Estado civil: Viúva
Nome do pai: JOSÉ FICTÍCIO SANTOS
Nome da mãe: ANA FICTÍCIA
Data do óbito: 2026-10-10   Hora: 14:30
Local do óbito: Hospital Fictício, Lisboa
Declarante: Rui Fictício Santos
Data do registo: 2026-10-12
O Conservador`;

const POR_EXTENSO = `CERTIDÃO DE ÓBITO
Nome completo: António Fictício Pereira
Faleceu no dia 3 de setembro de 2026, pelas 08:00 horas
Assento lavrado em 05/09/2026`;

const LINHAS_PARTIDAS = `Nome
JOAQUIM FICTÍCIO DOS ANJOS
Data do óbito
02.11.2026
Data do assento
04.11.2026`;

// Formato de uma certidão real de uma conservatória, lida por OCR, com os dados trocados.
const CONSERVATORIA = `Conservatória do Registo Civil/Predial/Comercial Fictícia
Assento de Óbito n.º 999 do ano de 2024
Falecido
Nome: Rosa Fictícia da Silva Exemplo *** :
Sexo: Feminino ***
Idade: 90 anos ***
Estado: Viúvo(a) Manuel Fictício Exemplo***
Naturalidade: freguesia de Exemplo ***
Pai: Joaquim Fictício ***
Mãe: Ana Fictícia ***
Hora e data do - 07 horas e 00 minutos , do dia 24 de julho de 2024 ***
falecimento:
Lugar: freguesia de Exemplo ***
Declarante(s): Rui Fictício, com residência habitual em Rua Fictícia
Data do assento: 25 de julho de 2024 ***
O/A Oficial de registos, Teresa Fictícia , Por competência própria
Cota : Assento de Nascimento 43/2020 - 2024-07-25`;

describe('certidão de óbito (no dispositivo, sem IA)', () => {
  it('lê a certidão de uma conservatória, com o rótulo do falecimento partido pelo OCR', () => {
    expect(readDeathCertificate(CONSERVATORIA)).toEqual({
      nome: 'Rosa Fictícia da Silva Exemplo',
      data_obito: '2024-07-24',
      data_registo_obito: '2024-07-25',
    });
  });

  it('lê o nome da pessoa, a data do óbito e a do registo, sem confundir pais e nascimento', () => {
    expect(readDeathCertificate(ELETRONICA)).toEqual({
      nome: 'Maria da Conceição Fictícia Santos',
      data_obito: '2026-10-10',
      data_registo_obito: '2026-10-12',
    });
  });

  it('aceita datas por extenso e "assento lavrado em"', () => {
    expect(readDeathCertificate(POR_EXTENSO)).toEqual({
      nome: 'António Fictício Pereira',
      data_obito: '2026-09-03',
      data_registo_obito: '2026-09-05',
    });
  });

  it('aceita o valor na linha seguinte ao rótulo (OCR com linhas partidas)', () => {
    expect(readDeathCertificate(LINHAS_PARTIDAS)).toEqual({
      nome: 'Joaquim Fictício dos Anjos',
      data_obito: '2026-11-02',
      data_registo_obito: '2026-11-04',
    });
  });

  it('descarta um registo anterior ao óbito', () => {
    const r = readDeathCertificate('Data do óbito: 10/10/2026\nData do registo: 01/10/2026');
    expect(r.data_obito).toBe('2026-10-10');
    expect(r.data_registo_obito).toBe('');
  });

  it('devolve campos vazios num texto que não é uma certidão', () => {
    expect(readDeathCertificate('Fatura simplificada\nTotal 34,99 €')).toEqual({
      nome: '',
      data_obito: '',
      data_registo_obito: '',
    });
  });

  it('passa maiúsculas a nome próprio e deixa as partículas em minúsculas', () => {
    expect(properName('ANA  DOS SANTOS E SILVA')).toBe('Ana dos Santos e Silva');
    expect(properName('Ana McDonald')).toBe('Ana McDonald');
  });
});
