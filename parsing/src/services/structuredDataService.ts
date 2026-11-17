import { buildContratoSummary, extractContrato, isContrato } from './contratoService';
import type { DocumentMetadata } from './documentMetadataService';
import { buildMvpExtractionSummary } from './documentMetadataService';
import { extractNotaFiscal } from './notaFiscalService';
import type { ParserExtraction } from './ollamaService';
import type { StructuredTables } from './tableParserService';

/**
 * Montagem do `structured_data` devolvido pelo upload — separada de `pdfService` para
 * poder ser testada sem PDF, sem `pdf-parse` e sem banco.
 *
 * A regra geral é: `dados` da extração genérica primeiro, metadados por cima e, quando o
 * documento é um contrato, o bloco `contrato` (da extração dedicada) por último.
 */

export type StructuredDataInput = {
  rawText: string;
  pageCount: number;
  extraction: ParserExtraction;
  structuredTables: StructuredTables;
  documentMetadata: DocumentMetadata;
  tableExtractionError?: string | null;
};

export type StructuredDataResult = {
  structuredData: Record<string, unknown>;
  extractionSummary: string;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const soDigitos = (value: string) => value.replace(/\D/g, '');

/** Coloca `item` na frente da lista, removendo o mesmo item (comparado por `mesmo`) do resto. */
const priorizar = (lista: string[], item: string, mesmo: (a: string, b: string) => boolean): string[] => [
  item,
  ...lista.filter((atual) => !mesmo(atual, item)),
];

const withTableError = (
  tables: StructuredTables,
  tableExtractionError?: string | null,
): StructuredTables => {
  if (!tableExtractionError) return tables;
  return {
    ...tables,
    avisos_extracao: [
      ...tables.avisos_extracao,
      `Nao foi possivel extrair as tabelas do PDF: ${tableExtractionError}`,
    ],
  };
};

export const buildStructuredData = (input: StructuredDataInput): StructuredDataResult => {
  const { rawText, pageCount, extraction, documentMetadata } = input;
  const structuredTables = withTableError(input.structuredTables, input.tableExtractionError);

  let extractionSummary = buildMvpExtractionSummary({
    metadata: documentMetadata,
    tables: structuredTables,
    pageCount,
    aiSummary: extraction.resumo,
  });

  const structuredData: Record<string, unknown> = {
    ...extraction.dados,
    ...documentMetadata,
    schema_version: '2.1-mvp',
    quantidade_paginas: pageCount,
    ...structuredTables,
  };

  if (extraction.dados.tipo_documento === 'nota_fiscal') {
    structuredData.nota_fiscal = extractNotaFiscal(
      rawText,
      documentMetadata,
      (extraction.dados.campos_rotulados ?? {}) as Record<string, string>,
      asStringArray(extraction.dados.cnpjs),
    );
  }

  if (isContrato(rawText)) {
    const contrato = extractContrato(rawText);
    structuredData.tipo_documento = 'contrato';
    structuredData.contrato = contrato;

    const dataAssinaturaBr = contrato.assinatura.data
      ? contrato.assinatura.data.split('-').reverse().join('/')
      : null;

    // Campos de topo usados por consumidores genéricos (ex.: tela de importação de
    // licitações). Só sobrescreve quando o contrato trouxe valor; os demais ficam como
    // a extração genérica deixou.
    const overrides: Record<string, unknown> = {
      processo: contrato.numero_processo,
      modalidade: contrato.modalidade,
      objeto: contrato.objeto,
      orgao: contrato.contratante.nome,
      cliente: contrato.contratante.nome,
      cnpj_orgao: contrato.contratante.tipo_documento === 'CNPJ' ? contrato.contratante.documento : null,
      responsavel: contrato.contratante.representante?.nome,
      data_documento: dataAssinaturaBr,
      fornecedor: contrato.contratado.nome,
      nome_fornecedor: contrato.contratado.nome,
      cnpj_fornecedor: contrato.contratado.tipo_documento === 'CNPJ' ? contrato.contratado.documento : null,
      documento_fornecedor: contrato.contratado.documento,
    };
    for (const [key, value] of Object.entries(overrides)) {
      if (value) structuredData[key] = value;
    }

    // Listas genéricas: consumidores usam o 1º item como "fornecedor"/"CNPJ"/"validade".
    // Sem reordenar, o 1º CNPJ do documento é o da própria prefeitura (contratante) e a
    // 1ª data pode ser o carimbo do gov.br (que o OCR lê errado).
    if (contrato.contratado.nome) {
      structuredData.empresas = [contrato.contratado.nome];
    }
    if (contrato.contratado.documento) {
      structuredData.cnpjs = priorizar(
        asStringArray(structuredData.cnpjs),
        contrato.contratado.documento,
        (a, b) => soDigitos(a) === soDigitos(b),
      );
    }
    if (dataAssinaturaBr) {
      structuredData.datas = priorizar(asStringArray(structuredData.datas), dataAssinaturaBr, (a, b) => a === b);
    }

    extractionSummary = buildContratoSummary(contrato);
  }

  return { structuredData, extractionSummary };
};
