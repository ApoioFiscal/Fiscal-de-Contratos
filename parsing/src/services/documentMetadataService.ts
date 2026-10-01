import type { BudgetTotals, StructuredTables } from './tableParserService';

export type DocumentMetadata = {
  orgao: string | null;
  cliente: string | null;
  objeto: string | null;
  descricao: string | null;
  responsavel: string | null;
  registro_responsavel: string | null;
  cnpj_orgao: string | null;
  data_documento: string | null;
  percentual_bdi: string | null;
};

const clean = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
};

const firstMatch = (text: string, patterns: RegExp[]): string | null => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = clean(match?.[1]);
    if (value) return value;
  }
  return null;
};

const extractLabelFromLines = (text: string, label: string): string | null => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalizedLabel = label.toUpperCase();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const upper = line.toUpperCase();
    const markerIndex = upper.indexOf(`${normalizedLabel}:`);

    if (markerIndex === -1) continue;

    const sameLineValue = clean(line.slice(markerIndex + normalizedLabel.length + 1));
    if (sameLineValue && !/^(DATA|BDI)\s*:/i.test(sameLineValue)) {
      return sameLineValue;
    }

    const collected: string[] = [];
    for (let next = index + 1; next < Math.min(lines.length, index + 6); next += 1) {
      const candidate = lines[next];
      if (/^(OBRA|DESCRI[CÇ][AÃ]O|CLIENTE|DATA|BDI|FONTE|ITEM|PLANILHA|MEM[ÓO]RIAS|CRONOGRAMA|RELAT[ÓO]RIO|COMPOSI[CÇ][AÃ]O|TABELA)\s*:/i.test(candidate)) {
        break;
      }
      collected.push(candidate);
    }

    const joined = clean(collected.join(' '));
    if (joined) return joined;
  }

  return null;
};

const inferResponsible = (text: string): string | null => {
  const lines = text.split(/\r?\n/).map((line) => clean(line)).filter((line): line is string => Boolean(line));

  for (let index = 0; index < lines.length; index += 1) {
    if (/^(CAU|CREA|CRC|OAB)\s*(N[º°O.]*)?/i.test(lines[index])) {
      const previous = lines[index - 1];
      if (previous && /^[A-ZÀ-Ü][A-ZÀ-Ü\s.'-]{5,}$/.test(previous)) return previous;
    }
  }

  return null;
};

export const extractDocumentMetadata = (text: string): DocumentMetadata => {
  const cliente = firstMatch(text, [
    /CLIENTE\s*:\s*((?:PREFEITURA|C[ÂA]MARA|SECRETARIA|FUNDO|MUNIC[ÍI]PIO|ESTADO|GOVERNO)[^\n\r]{3,120})/i,
  ]) ?? extractLabelFromLines(text, 'CLIENTE');
  const objeto = firstMatch(text, [
    /OBRA\s*:\s*([^\n\r]{20,500})/i,
  ]) ?? extractLabelFromLines(text, 'OBRA');
  const descricao = firstMatch(text, [
    /DESCRI[CÇ][AÃ]O\s*:\s*([^\n\r]{20,500})/i,
  ]) ?? extractLabelFromLines(text, 'DESCRIÇÃO') ?? extractLabelFromLines(text, 'DESCRICAO');

  return {
    orgao: cliente,
    cliente,
    objeto,
    descricao,
    responsavel: inferResponsible(text),
    registro_responsavel: firstMatch(text, [/\b(CAU\s*N?[º°O.]?\s*[A-Z0-9.-]+)\b/i, /\b(CREA\s*N?[º°O.]?\s*[A-Z0-9.-]+)\b/i]),
    cnpj_orgao: firstMatch(text, [/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/]),
    data_documento: firstMatch(text, [/(\d{2}\/\d{2}\/\d{4})/]),
    percentual_bdi: firstMatch(text, [/BDI\s*[:=]?\s*(\d{1,3},\d{1,2}\s*%)/i]),
  };
};

const displayValue = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || null;

export const buildMvpExtractionSummary = (input: {
  metadata: DocumentMetadata;
  tables: StructuredTables;
  pageCount: number;
  aiSummary?: string | null;
}): string => {
  const { metadata, tables, pageCount } = input;
  const totals: BudgetTotals = tables.totais_orcamentarios;
  const subject = displayValue(metadata.objeto ?? metadata.descricao ?? input.aiSummary);
  const orgao = displayValue(metadata.orgao);
  const total = displayValue(totals.valor_total);
  const bdi = displayValue(metadata.percentual_bdi);

  const sentences: string[] = [];
  if (subject) sentences.push(subject.replace(/[.]+$/, ''));
  if (orgao) sentences.push(`Órgão: ${orgao}`);

  const details = [
    `${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}`,
    `${tables.itens_orcamentarios.length} ${tables.itens_orcamentarios.length === 1 ? 'item orçamentário' : 'itens orçamentários'}`,
    `${tables.composicoes_custo.length} ${tables.composicoes_custo.length === 1 ? 'composição de custo' : 'composições de custo'}`,
    `${tables.cronogramas.length} ${tables.cronogramas.length === 1 ? 'cronograma' : 'cronogramas'}`,
  ];

  if (total) details.push(`valor total de ${total}`);
  if (bdi) details.push(`BDI de ${bdi}`);
  sentences.push(details.join(', '));

  return `${sentences.join('. ')}.`;
};
