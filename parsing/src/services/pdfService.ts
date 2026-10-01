import { PDFParse, type TableResult, type TextResult } from 'pdf-parse';
import { readFile } from 'fs/promises';
import { savePdfDocument } from './dbService';
import { extractStructuredData } from './parserService';
import { extractStructuredTables } from './tableParserService';
import { buildMvpExtractionSummary, extractDocumentMetadata } from './documentMetadataService';
import { extractNotaFiscal } from './notaFiscalService';

type ParsePdfInput = {
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export class InvalidPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPdfError';
  }
}

export const parsePdfAndPersist = async (input: ParsePdfInput) => {
  const dataBuffer = await readFile(input.filePath);

  if (dataBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new InvalidPdfError('O arquivo enviado nao possui a assinatura de um PDF valido.');
  }

  const parser = new PDFParse({ data: dataBuffer });
  let pdfData: TextResult;
  let tableData: TableResult | null = null;
  let tableExtractionError: string | null = null;

  try {
    pdfData = await parser.getText();

    try {
      tableData = await parser.getTable();
    } catch (error) {
      tableExtractionError = error instanceof Error ? error.message : String(error);
    }
  } catch {
    throw new InvalidPdfError('Nao foi possivel ler o conteudo do PDF.');
  } finally {
    await parser.destroy();
  }

  const rawText = String(pdfData.text ?? '').trim();

  if (!rawText) {
    throw new InvalidPdfError(
      'Nao foi possivel extrair texto do PDF. O arquivo pode ser escaneado ou estar vazio.',
    );
  }

  const extraction = await extractStructuredData(rawText);
  const structuredTables = extractStructuredTables(tableData?.pages ?? []);
  const documentMetadata = extractDocumentMetadata(rawText);

  if (tableExtractionError) {
    structuredTables.avisos_extracao.push(
      `Nao foi possivel extrair as tabelas do PDF: ${tableExtractionError}`,
    );
  }

  const extractionSummary = buildMvpExtractionSummary({
    metadata: documentMetadata,
    tables: structuredTables,
    pageCount: pdfData.total,
    aiSummary: extraction.resumo,
  });

  const structuredData: Record<string, unknown> = {
    ...extraction.dados,
    ...documentMetadata,
    schema_version: '2.1-mvp',
    quantidade_paginas: pdfData.total,
    ...structuredTables,
  };

  if (extraction.dados.tipo_documento === 'nota_fiscal') {
    structuredData.nota_fiscal = extractNotaFiscal(
      rawText,
      documentMetadata,
      extraction.dados.campos_rotulados as Record<string, string>,
      extraction.dados.cnpjs as string[],
    );
  }

  return savePdfDocument({
    originalName: input.originalName,
    mimeType: input.mimeType,
    size: input.size,
    rawText,
    structuredData,
    extractionSummary,
  });
};
