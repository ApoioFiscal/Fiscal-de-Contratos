import type { DocumentMetadata } from './documentMetadataService';

export type NotaFiscalExtraction = {
  numero: string | null;
  data_de_emissao: string | null;
  fornecedor: string | null;
  cnpj_emitente: string | null;
  valor_total: string | null;
  observacao_extracao: string | null;
};

const NUMERO_PATTERNS = [
  /\bNOTA\s*FISCAL(?:\s*(?:E\s+)?(?:ELETRONICA|ELECTRONICA))?\s*N\s*[º\s]*[:.]?\s*(\d{1,12})\b/i,
  /\bNF(?:-?E)?\s*N\s*[º°]?\s*[:.-]?\s*(\d{1,12})\b/i,
  /\bNF\s*[#.:\s-]+\s*(\d{6,12})\b/i,
  /\b(?:NUMERO|NO\.)\s*DA\s*NOTA\s*[:.]?\s*(\d{1,12})\b/i,
];

const CAMPO_FORNECEDOR = [
  'fornecedor',
  'razao_social',
  'emitente',
  'denominacao',
  'razão_social',
  'nome_do_emitente',
  'empresa',
];

const CAMPO_TOTAL = [
  'valor_total',
  'total',
  'valor_total_da_nota',
  'valor_da_nota',
  'total_da_nota',
];

export const extrairNumeroNota = (text: string): string | null => {
  for (const pattern of NUMERO_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const firstLabeled = (campos: Record<string, string>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = campos[key]?.trim();
    if (value) return value;
  }
  return null;
};

export const extractNotaFiscal = (
  text: string,
  metadata: Pick<DocumentMetadata, 'data_documento'>,
  camposRotulados: Record<string, string>,
  cnpjs: string[],
): NotaFiscalExtraction => {
  const numero = extrairNumeroNota(text);
  const fornecedor = firstLabeled(camposRotulados, CAMPO_FORNECEDOR);

  let cnpjEmitente: string | null = camposRotulados.cnpj ?? null;

  if (fornecedor) {
    const linhaFornecedor = text
      .split(/\r?\n/)
      .find((line) => line.includes(fornecedor as string));

    const cnpjNaLinha = linhaFornecedor?.match(
      /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/,
    );

    if (cnpjNaLinha) {
      cnpjEmitente = cnpjNaLinha[0];
    }
  }

  if (!cnpjEmitente && cnpjs.length > 0) {
    cnpjEmitente = cnpjs[0];
  }

  const valorTotal = firstLabeled(camposRotulados, CAMPO_TOTAL);

  return {
    numero,
    data_de_emissao: metadata.data_documento,
    fornecedor,
    cnpj_emitente: cnpjEmitente,
    valor_total: valorTotal,
    observacao_extracao:
      numero && fornecedor ? null : 'numero_ou_emitente_nao_reconhecidos',
  };
};