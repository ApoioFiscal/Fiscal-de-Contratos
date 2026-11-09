// O `pdf-parse` carrega `@napi-rs/canvas` via createRequire dinâmico para
// preencher DOMMatrix/ImageData/Path2D (usa `new DOMMatrix` no topo do módulo).
// A análise estática da Vercel não enxerga esse require, então o pacote ficava
// fora do bundle e a função morria com "DOMMatrix is not defined". Este import
// explícito garante que o pacote (e o binário linux-x64-gnu) entre no bundle.
import '@napi-rs/canvas';
import { PDFParse, type TableResult, type TextResult } from 'pdf-parse';
import { readFile } from 'fs/promises';
import { savePdfDocument } from './dbService';
import { extractStructuredData } from './parserService';
import { extractStructuredTables } from './tableParserService';
import { extractDocumentMetadata } from './documentMetadataService';
import { buildStructuredData } from './structuredDataService';

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

  const { structuredData, extractionSummary } = buildStructuredData({
    rawText,
    pageCount: pdfData.total,
    extraction,
    structuredTables,
    documentMetadata,
    tableExtractionError,
  });

  return savePdfDocument({
    originalName: input.originalName,
    mimeType: input.mimeType,
    size: input.size,
    rawText,
    structuredData,
    extractionSummary,
  });
};
