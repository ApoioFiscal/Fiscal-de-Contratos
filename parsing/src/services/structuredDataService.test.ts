import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { extractDocumentMetadata } from './documentMetadataService';
import { extractWithRules } from './rulesParserService';
import { buildStructuredData } from './structuredDataService';
import { extractStructuredTables } from './tableParserService';

const OCR_FIXTURE = readFileSync(
  path.join(__dirname, '__fixtures__', 'contrato_dv00014_2026.ocr.txt'),
  'utf8',
);

/** Reproduz a montagem do upload sem PDF, sem pdf-parse e sem banco. */
const montar = (rawText: string) =>
  buildStructuredData({
    rawText,
    pageCount: 3,
    extraction: extractWithRules(rawText),
    structuredTables: extractStructuredTables([]),
    documentMetadata: extractDocumentMetadata(rawText),
  });

test('contrato: bloco `contrato` anexado, topo sobrescrito e resumo dedicado', () => {
  const { structuredData, extractionSummary } = montar(OCR_FIXTURE);
  const contrato = structuredData.contrato as Record<string, any>;

  assert.equal(structuredData.tipo_documento, 'contrato');
  assert.equal(contrato.numero_contrato, '00141/2026-SDC');

  assert.equal(structuredData.processo, '260803DV00014');
  assert.equal(structuredData.modalidade, 'Dispensa de Licitação');
  assert.equal(structuredData.objeto, contrato.objeto);
  assert.equal(structuredData.orgao, 'Prefeitura Municipal de Marizópolis');
  assert.equal(structuredData.cliente, 'Prefeitura Municipal de Marizópolis');
  assert.equal(structuredData.cnpj_orgao, '01.612.941/0001-49');
  assert.equal(structuredData.responsavel, 'Lucas Gonçalves Braga');
  assert.equal(structuredData.data_documento, '19/08/2026');

  assert.match(extractionSummary, /^Contrato 00141\/2026-SDC/);
  assert.match(extractionSummary, /RENATA RODRIGUES LOURENCO DE ALMEIDA/);
});

test('contrato: fornecedor, CNPJ e data apontam para o contratado (não para a prefeitura)', () => {
  const { structuredData } = montar(OCR_FIXTURE);

  assert.deepEqual(structuredData.empresas, ['RENATA RODRIGUES LOURENCO DE ALMEIDA']);
  assert.equal(structuredData.fornecedor, 'RENATA RODRIGUES LOURENCO DE ALMEIDA');

  const cnpjs = structuredData.cnpjs as string[];
  assert.equal(cnpjs[0], '35.848.636/0001-72'); // contratado primeiro
  assert.ok(cnpjs.includes('01.612.941/0001-49')); // prefeitura continua na lista

  // O único "dd/mm/aaaa" do OCR é o carimbo do gov.br lido como 19/08/2076.
  // A data da assinatura por extenso (2026-08-19) precisa vir na frente.
  const datas = structuredData.datas as string[];
  assert.equal(datas[0], '19/08/2026');
  assert.equal(datas.filter((data) => data === '19/08/2026').length, 1);
});

test('edital com minuta anexa não ganha bloco `contrato`', () => {
  const edital = `EDITAL DE PREGÃO ELETRÔNICO Nº 012/2026
A PREFEITURA MUNICIPAL DE EXEMPLO torna público que realizará licitação.
ANEXO VI - MINUTA DE TERMO DE CONTRATO
Pelo presente instrumento, de um lado o MUNICÍPIO DE EXEMPLO, CNPJ 12.345.678/0001-90, doravante simplesmente CONTRATANTE, e do outro lado a empresa vencedora, doravante simplesmente CONTRATADA, celebram o presente contrato.
CLÁUSULA PRIMEIRA - DO OBJETO: o objeto é o descrito no edital.
CLÁUSULA SEGUNDA - DO VALOR: o da proposta vencedora.
CLÁUSULA TERCEIRA - DA VIGÊNCIA: 12 meses.
`;

  const { structuredData } = montar(edital);

  assert.equal(structuredData.tipo_documento, 'pregao');
  assert.equal(structuredData.contrato, undefined);
  assert.equal(structuredData.fornecedor, undefined);
  assert.equal(structuredData.empresas, undefined);
});

test('nota fiscal continua recebendo o bloco `nota_fiscal`', () => {
  const nota = `NOTA FISCAL Nº 123
DATA DE EMISSÃO: 05/03/2026
FORNECEDOR: ACME COMERCIO LTDA
CNPJ: 98.765.432/0001-10
VALOR TOTAL: R$ 1.250,00
`;
  const { structuredData } = montar(nota);

  assert.equal(structuredData.tipo_documento, 'nota_fiscal');
  assert.ok(structuredData.nota_fiscal);
  assert.equal(structuredData.contrato, undefined);
});
