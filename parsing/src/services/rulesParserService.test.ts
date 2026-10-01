import assert from 'node:assert/strict';
import test from 'node:test';
import { extractWithRules } from './rulesParserService';
import { extractStructuredTables, parseBrazilianNumber } from './tableParserService';
import { normalizeUploadFileName } from '../utils/fileName';

test('extrai campos comuns e remove valores duplicados', () => {
  const extraction = extractWithRules(`
    Licitação pública
    Órgão: Prefeitura Municipal
    CNPJ: 01.612.941/0001-49
    Data: 13/07/2026
    Valor: R$ 1.250,00
    Contato: compras@prefeitura.gov.br
    CNPJ: 01.612.941/0001-49
  `);

  assert.equal(extraction.dados.tipo_documento, 'licitacao');
  assert.deepEqual(extraction.dados.cnpjs, ['01.612.941/0001-49']);
  assert.deepEqual(extraction.dados.datas, ['13/07/2026']);
  assert.deepEqual(extraction.dados.valores, ['R$ 1.250,00']);
  assert.deepEqual(extraction.dados.emails, ['compras@prefeitura.gov.br']);
  assert.equal(extraction.dados.campos_rotulados['órgão'], 'Prefeitura Municipal');
});

test('retorna listas vazias para texto sem dados reconhecidos', () => {
  const extraction = extractWithRules('Documento sem padrões cadastrais conhecidos.');

  assert.equal(extraction.dados.tipo_documento, null);
  assert.deepEqual(extraction.dados.cpfs, []);
  assert.deepEqual(extraction.dados.cnpjs, []);
  assert.deepEqual(extraction.dados.datas, []);
  assert.deepEqual(extraction.dados.valores, []);
});

test('nao confunde codigos e coeficientes com CEP ou valor monetario', () => {
  const extraction = extractWithRules(`
    CEP: 58819000
    Código SINAPI: 00002510
    Coeficiente: 1,00000000
    Percentual: 22,23%
    Total: R$ 1.077.960,00
  `);

  assert.deepEqual(extraction.dados.ceps, ['58819000']);
  assert.deepEqual(extraction.dados.valores, ['R$ 1.077.960,00']);
});

test('organiza item orcamentario preservando todas as celulas originais', () => {
  const originalRow = [
    '1.1',
    '2026',
    'SERVIÇO DE SISTEMA DE ILUMINAÇÃO PUBLICA',
    'SINAPI',
    'UND',
    '400,00',
    'R$ 2.204,78',
    'R$ 490,12',
    'R$ 2.694,90',
    'R$ 1.077.960,00',
  ];

  const extraction = extractStructuredTables([{
    num: 1,
    tables: [[
      ['ITEM', 'CÓDIGO', 'DESCRIÇÃO', 'FONTE', 'UNIDADE', 'QTD', 'VALOR UNITÁRIO R$', 'PREÇO TOTAL R$'],
      ['SEM BDI', 'BDI', 'COM BDI'],
      originalRow,
      ['VALOR BDI TOTAL: R$ 196.048,00\nVALOR ORÇAMENTO: R$ 881.912,00\nVALOR TOTAL: R$ 1.077.960,00'],
    ]],
  }]);

  assert.equal(extraction.itens_orcamentarios.length, 1);
  assert.deepEqual(extraction.itens_orcamentarios[0].linha_original, originalRow);
  assert.equal(extraction.itens_orcamentarios[0].quantidade, '400,00');
  assert.equal(extraction.itens_orcamentarios[0].valor_unitario_com_bdi, 'R$ 2.694,90');
  assert.equal(extraction.itens_orcamentarios[0].valor_total, 'R$ 1.077.960,00');
  assert.equal(
    extraction.itens_orcamentarios[0].validacoes.quantidade_vezes_valor_com_bdi_confere,
    true,
  );
  assert.equal(extraction.totais_orcamentarios.valor_bdi_total, 'R$ 196.048,00');
  assert.equal(extraction.totais_orcamentarios.valor_orcamento, 'R$ 881.912,00');
  assert.equal(extraction.totais_orcamentarios.valor_total, 'R$ 1.077.960,00');
});

test('separa composicoes de custo dos itens principais', () => {
  const extraction = extractStructuredTables([{
    num: 4,
    tables: [[
      ['Material', 'FONTE', 'UNID', 'COEFICIENTE', 'PREÇO UNITÁRIO', 'TOTAL'],
      ['I8842', 'CABO DE ALUMÍNIO', 'SEINFRA', 'M', '2,00000000', 'R$ 2,57', 'R$ 5,14'],
      ['TOTAL Material:', 'R$ 5,14'],
    ]],
  }]);

  assert.equal(extraction.itens_orcamentarios.length, 0);
  assert.equal(extraction.composicoes_custo.length, 1);
  assert.equal(extraction.composicoes_custo[0].categoria, 'Material');
  assert.equal(extraction.composicoes_custo[0].codigo, 'I8842');
  assert.equal(extraction.composicoes_custo[0].coeficiente, '2,00000000');
});

test('organiza percentuais e valores do cronograma por periodo', () => {
  const extraction = extractStructuredTables([{
    num: 3,
    tables: [[
      ['ITEM', 'DESCRIÇÃO', 'VALOR (R$)', 'MÊS 1', 'MÊS 2', 'Total parcela'],
      ['1', 'SERVIÇO DE ILUMINAÇÃO', 'R$ 1.077.960,00', '35,00 %', '65,00 %', '100,00 %'],
      ['R$ 377.286,00', 'R$ 700.674,00', 'R$ 1.077.960,00'],
    ]],
  }]);

  assert.equal(extraction.cronogramas.length, 1);
  assert.deepEqual(extraction.cronogramas[0].periodos, [
    {
      periodo: 'MÊS 1',
      percentual: '35,00 %',
      valor: 'R$ 377.286,00',
      percentual_numerico: 35,
      valor_numerico: 377286,
    },
    {
      periodo: 'MÊS 2',
      percentual: '65,00 %',
      valor: 'R$ 700.674,00',
      percentual_numerico: 65,
      valor_numerico: 700674,
    },
  ]);
});

test('converte numeros brasileiros sem substituir o texto original', () => {
  assert.equal(parseBrazilianNumber('R$ 1.077.960,00'), 1077960);
  assert.equal(parseBrazilianNumber('22,23%'), 22.23);
  assert.equal(parseBrazilianNumber('texto'), null);
});

test('corrige nome UTF-8 interpretado como latin1 no upload', () => {
  assert.equal(normalizeUploadFileName('PROJETO_LICITAÃÃO.pdf'), 'PROJETO_LICITAÇÃO.pdf');
  assert.equal(normalizeUploadFileName('LICITAÇÃO.pdf'), 'LICITAÇÃO.pdf');
});

import {
  buildMvpExtractionSummary,
  extractDocumentMetadata,
} from './documentMetadataService';
import { extractNotaFiscal } from './notaFiscalService';

test('extrai metadados institucionais do documento sem depender da IA', () => {
  const metadata = extractDocumentMetadata(`
    OBRA: CONTRATAÇÃO DE EMPRESA ESPECIALIZADA PARA IMPLANTAÇÃO DE ILUMINAÇÃO PÚBLICA.
    DESCRIÇÃO: EXECUÇÃO DE SERVIÇOS DE ILUMINAÇÃO PÚBLICA EM LED.
    CLIENTE: PREFEITURA MUNICIPAL DE MARIZÓPOLIS
    DATA: 05/06/2026 BDI: 22,23%
    ALAN DE FIGUEIREDO OLIVEIRA
    CAU Nº A1108590
    CNPJ: 01.612.941/0001-49
  `);

  assert.equal(metadata.orgao, 'PREFEITURA MUNICIPAL DE MARIZÓPOLIS');
  assert.equal(metadata.cliente, 'PREFEITURA MUNICIPAL DE MARIZÓPOLIS');
  assert.equal(metadata.objeto, 'CONTRATAÇÃO DE EMPRESA ESPECIALIZADA PARA IMPLANTAÇÃO DE ILUMINAÇÃO PÚBLICA.');
  assert.equal(metadata.responsavel, 'ALAN DE FIGUEIREDO OLIVEIRA');
  assert.equal(metadata.registro_responsavel, 'CAU Nº A1108590');
  assert.equal(metadata.cnpj_orgao, '01.612.941/0001-49');
  assert.equal(metadata.data_documento, '05/06/2026');
  assert.equal(metadata.percentual_bdi, '22,23%');
});

test('gera resumo legivel sem virgula inicial e com dados importantes do MVP', () => {
  const tables = extractStructuredTables([{
    num: 1,
    tables: [[
      ['ITEM', 'CÓDIGO', 'DESCRIÇÃO', 'FONTE', 'UNIDADE', 'QTD', 'VALOR UNITÁRIO R$', 'PREÇO TOTAL R$'],
      ['SEM BDI', 'BDI', 'COM BDI'],
      ['1.1', '2026', 'SERVIÇO DE ILUMINAÇÃO', 'SINAPI', 'UND', '400,00', 'R$ 2.204,78', 'R$ 490,12', 'R$ 2.694,90', 'R$ 1.077.960,00'],
      ['VALOR TOTAL: R$ 1.077.960,00'],
    ]],
  }]);

  const summary = buildMvpExtractionSummary({
    metadata: {
      orgao: 'PREFEITURA MUNICIPAL DE MARIZÓPOLIS',
      cliente: 'PREFEITURA MUNICIPAL DE MARIZÓPOLIS',
      objeto: 'IMPLANTAÇÃO DE ILUMINAÇÃO PÚBLICA EM LED',
      descricao: null,
      responsavel: null,
      registro_responsavel: null,
      cnpj_orgao: null,
      data_documento: null,
      percentual_bdi: '22,23%',
    },
    tables,
    pageCount: 6,
  });

  assert.equal(summary.startsWith(','), false);
  assert.match(summary, /IMPLANTAÇÃO DE ILUMINAÇÃO PÚBLICA EM LED/);
  assert.match(summary, /1 item orçamentário/);
  assert.match(summary, /valor total de R\$ 1\.077\.960,00/);
  assert.match(summary, /BDI de 22,23%/);
});

test('extrai numero, emitente, CNPJ e total de uma nota fiscal', () => {
  const camposRotulados = {
    fornecedor: 'MEDTECH DISTRIBUIDORA LTDA',
    numero: '004512',
    data_emissao: '28/09/2026',
    valor_total: 'R$ 3.875,00',
    cnpj: '12.345.678/0001-90',
  };

  const nota = extractNotaFiscal(
    `NOTA FISCAL ELETRONICA N: 004512\nFORNECEDOR: MEDTECH DISTRIBUIDORA LTDA\nCNPJ: 12.345.678/0001-90\nVALOR TOTAL: R$ 3.875,00\nDATA EMISSAO: 28/09/2026`,
    { data_documento: '28/09/2026' },
    camposRotulados,
    ['12.345.678/0001-90'],
  );

  assert.equal(nota.numero, '004512');
  assert.equal(nota.fornecedor, 'MEDTECH DISTRIBUIDORA LTDA');
  assert.equal(nota.cnpj_emitente, '12.345.678/0001-90');
  assert.equal(nota.valor_total, 'R$ 3.875,00');
  assert.equal(nota.data_de_emissao, '28/09/2026');
  assert.equal(nota.observacao_extracao, null);
});

test('nota fiscal sem numero reconhecido sinaliza observacao de extracao', () => {
  const nota = extractNotaFiscal(
    'Extrato simples sem identificacao de nota.',
    { data_documento: null },
    {},
    [],
  );

  assert.equal(nota.numero, null);
  assert.equal(nota.fornecedor, null);
  assert.equal(nota.cnpj_emitente, null);
  assert.equal(nota.observacao_extracao, 'numero_ou_emitente_nao_reconhecidos');
});
