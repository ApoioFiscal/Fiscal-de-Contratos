export type RulesExtraction = {
  resumo: string;
  dados: {
    tipo_documento: string | null;
    emails: string[];
    cpfs: string[];
    cnpjs: string[];
    telefones: string[];
    ceps: string[];
    datas: string[];
    valores: string[];
    urls: string[];
    campos_rotulados: Record<string, string>;
    linhas_relevantes: string[];
  };
};

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const matchAll = (text: string, pattern: RegExp) => unique(text.match(pattern) ?? []);

const normalizeLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const extractLabelledFields = (lines: string[]) => {
  const fields: Record<string, string> = {};

  for (const line of lines) {
    const match = line.match(/^([A-Za-zÀ-ÿ0-9 ._/()-]{2,60})\s*[:=-]\s*(.{2,})$/);

    if (!match) {
      continue;
    }

    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    fields[key] = match[2].trim();
  }

  return fields;
};

const extractCeps = (text: string) => {
  const matches = [...text.matchAll(/\bCEP\s*:?\s*(\d{5}-?\d{3})\b/gi)];
  return unique(matches.map((match) => match[1]));
};

const inferDocumentType = (text: string) => {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('pregao') || lowerText.includes('pregão')) return 'pregao';
  if (lowerText.includes('licitacao') || lowerText.includes('licitação')) return 'licitacao';
  if (lowerText.includes('nota fiscal')) return 'nota_fiscal';
  if (lowerText.includes('boleto')) return 'boleto';
  if (lowerText.includes('contrato')) return 'contrato';
  if (lowerText.includes('recibo')) return 'recibo';
  if (lowerText.includes('relatorio') || lowerText.includes('relatório')) return 'relatorio';
  if (lowerText.includes('requerimento')) return 'requerimento';

  return null;
};

const buildSummary = (lines: string[], dados: RulesExtraction['dados']) => {
  const parts = [
    dados.tipo_documento ? `tipo: ${dados.tipo_documento}` : null,
    `${lines.length} linhas extraidas`,
    `${dados.datas.length} datas`,
    `${dados.valores.length} valores`,
    `${dados.cpfs.length + dados.cnpjs.length} documentos`,
  ].filter(Boolean);

  return parts.join(', ');
};

export const extractWithRules = (text: string): RulesExtraction => {
  const lines = normalizeLines(text);
  const dados: RulesExtraction['dados'] = {
    tipo_documento: inferDocumentType(text),
    emails: matchAll(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
    cpfs: matchAll(text, /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g),
    cnpjs: matchAll(text, /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g),
    telefones: matchAll(text, /\(?\b\d{2}\)?\s?(?:9\s?)?\d{4}-?\d{4}\b/g),
    ceps: extractCeps(text),
    datas: matchAll(text, /\b(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g),
    valores: matchAll(text, /R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}\b/gi),
    urls: matchAll(text, /https?:\/\/[^\s)]+/gi),
    campos_rotulados: extractLabelledFields(lines),
    linhas_relevantes: lines.slice(0, 40),
  };

  return {
    resumo: buildSummary(lines, dados),
    dados,
  };
};
