import type { PageTableResult, TableArray } from 'pdf-parse';

export type TableSectionType =
  | 'planilha_orcamentaria'
  | 'memoria_calculo'
  | 'cronograma_fisico_financeiro'
  | 'composicao_custos'
  | 'composicao_bdi'
  | 'encargos_sociais'
  | 'cabecalho_documento'
  | 'nao_classificada';

export type OriginalTable = {
  pagina: number;
  indice_tabela: number;
  tipo_secao: TableSectionType;
  linhas: string[][];
};

export type BudgetItem = {
  pagina_origem: number;
  tabela_origem: number;
  linha_origem: number;
  numero_item: string;
  codigo: string;
  descricao: string;
  fonte: string;
  unidade: string;
  quantidade: string;
  valor_unitario_sem_bdi: string;
  valor_bdi: string;
  valor_unitario_com_bdi: string;
  valor_total: string;
  quantidade_numerica: number | null;
  valor_unitario_sem_bdi_numerico: number | null;
  valor_bdi_numerico: number | null;
  valor_unitario_com_bdi_numerico: number | null;
  valor_total_numerico: number | null;
  validacoes: {
    quantidade_vezes_valor_com_bdi_confere: boolean | null;
  };
  linha_original: string[];
};

export type CostComposition = {
  pagina_origem: number;
  tabela_origem: number;
  linha_origem: number;
  categoria: string;
  codigo: string;
  descricao: string;
  fonte: string;
  unidade: string;
  coeficiente: string;
  valor_unitario: string;
  valor_total: string;
  coeficiente_numerico: number | null;
  valor_unitario_numerico: number | null;
  valor_total_numerico: number | null;
  linha_original: string[];
};

export type SchedulePeriod = {
  periodo: string;
  percentual: string;
  valor: string;
  percentual_numerico: number | null;
  valor_numerico: number | null;
};

export type FinancialSchedule = {
  pagina_origem: number;
  tabela_origem: number;
  numero_item: string;
  descricao: string;
  valor_total: string;
  valor_total_numerico: number | null;
  periodos: SchedulePeriod[];
  linha_percentuais_original: string[];
  linha_valores_original: string[];
};

export type BudgetTotals = {
  valor_bdi_total: string | null;
  valor_orcamento: string | null;
  valor_total: string | null;
  valor_bdi_total_numerico: number | null;
  valor_orcamento_numerico: number | null;
  valor_total_numerico: number | null;
};

export type StructuredTables = {
  tabelas_originais: OriginalTable[];
  itens_orcamentarios: BudgetItem[];
  composicoes_custo: CostComposition[];
  cronogramas: FinancialSchedule[];
  totais_orcamentarios: BudgetTotals;
  avisos_extracao: string[];
};

const normalizeForComparison = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const tableText = (table: TableArray) => normalizeForComparison(table.flat().join(' '));

const hasAll = (value: string, terms: string[]) => terms.every((term) => value.includes(term));

const classifyTable = (table: TableArray, pageText: string): TableSectionType => {
  const content = tableText(table);

  if (hasAll(content, ['ITEM', 'CODIGO', 'DESCRICAO', 'QTD']) && content.includes('VALOR UNITARIO')) {
    return 'planilha_orcamentaria';
  }

  if (hasAll(content, ['ITEM', 'DESCRICAO', 'VALOR (R$)', 'MES 1'])) {
    return 'cronograma_fisico_financeiro';
  }

  if (hasAll(content, ['COEFICIENTE', 'PRECO UNITARIO', 'TOTAL'])) {
    return 'composicao_custos';
  }

  if (hasAll(content, ['HORISTA %', 'MENSALISTA %'])) {
    return 'encargos_sociais';
  }

  if (hasAll(content, ['COD', 'DESCRICAO', '%']) && pageText.includes('COMPOSICAO DO BDI')) {
    return 'composicao_bdi';
  }

  if (content.includes('QTD') && pageText.includes('MEMORIAS DE CALCULO')) {
    return 'memoria_calculo';
  }

  if (content.includes('OBRA:') || content.includes('CLIENTE:')) {
    return 'cabecalho_documento';
  }

  if (pageText.includes('COMPOSICAO DO BDI')) return 'composicao_bdi';
  if (pageText.includes('TABELA DE ENCARGOS SOCIAIS')) return 'encargos_sociais';

  return 'nao_classificada';
};

export const parseBrazilianNumber = (value: string | undefined): number | null => {
  if (!value) return null;

  const compact = value.replace(/R\$/gi, '').replace(/%/g, '').replace(/\s+/g, '').trim();

  if (!/^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:,\d+)?$/.test(compact)) {
    return null;
  }

  const parsed = Number(compact.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const nearlyEqual = (left: number, right: number) => Math.abs(left - right) <= 0.01;

const extractBudgetItems = (
  table: TableArray,
  page: number,
  tableIndex: number,
): BudgetItem[] => {
  const headerIndex = table.findIndex((row) => {
    const header = normalizeForComparison(row.join(' '));
    return hasAll(header, ['ITEM', 'CODIGO', 'DESCRICAO', 'QTD']);
  });

  if (headerIndex === -1) return [];

  return table.slice(headerIndex + 1).flatMap((row, relativeIndex) => {
    const numeroItem = row[0] ?? '';
    const codigo = row[1] ?? '';
    const quantidade = row[5] ?? '';
    const valorTotal = row[9] ?? '';

    if (!/^\d+(?:\.\d+)+$/.test(numeroItem.trim()) || !codigo.trim() || !quantidade.trim() || !valorTotal.trim()) {
      return [];
    }

    const quantidadeNumerica = parseBrazilianNumber(quantidade);
    const valorComBdiNumerico = parseBrazilianNumber(row[8]);
    const valorTotalNumerico = parseBrazilianNumber(valorTotal);
    const canValidate =
      quantidadeNumerica !== null && valorComBdiNumerico !== null && valorTotalNumerico !== null;

    return [{
      pagina_origem: page,
      tabela_origem: tableIndex,
      linha_origem: headerIndex + relativeIndex + 2,
      numero_item: numeroItem,
      codigo,
      descricao: row[2] ?? '',
      fonte: row[3] ?? '',
      unidade: row[4] ?? '',
      quantidade,
      valor_unitario_sem_bdi: row[6] ?? '',
      valor_bdi: row[7] ?? '',
      valor_unitario_com_bdi: row[8] ?? '',
      valor_total: valorTotal,
      quantidade_numerica: quantidadeNumerica,
      valor_unitario_sem_bdi_numerico: parseBrazilianNumber(row[6]),
      valor_bdi_numerico: parseBrazilianNumber(row[7]),
      valor_unitario_com_bdi_numerico: valorComBdiNumerico,
      valor_total_numerico: valorTotalNumerico,
      validacoes: {
        quantidade_vezes_valor_com_bdi_confere: canValidate
          ? nearlyEqual(quantidadeNumerica * valorComBdiNumerico, valorTotalNumerico)
          : null,
      },
      linha_original: [...row],
    }];
  });
};

const extractCostCompositions = (
  table: TableArray,
  page: number,
  tableIndex: number,
): CostComposition[] => {
  const headerIndex = table.findIndex((row) => {
    const header = normalizeForComparison(row.join(' '));
    return hasAll(header, ['FONTE', 'UNID', 'COEFICIENTE', 'PRECO UNITARIO', 'TOTAL']);
  });

  if (headerIndex === -1) return [];
  const category = table[headerIndex]?.[0] ?? '';

  return table.slice(headerIndex + 1).flatMap((row, relativeIndex) => {
    if (row.length < 7 || !row[0]?.trim() || normalizeForComparison(row[0]).startsWith('TOTAL')) {
      return [];
    }

    return [{
      pagina_origem: page,
      tabela_origem: tableIndex,
      linha_origem: headerIndex + relativeIndex + 2,
      categoria: category,
      codigo: row[0] ?? '',
      descricao: row[1] ?? '',
      fonte: row[2] ?? '',
      unidade: row[3] ?? '',
      coeficiente: row[4] ?? '',
      valor_unitario: row[5] ?? '',
      valor_total: row[6] ?? '',
      coeficiente_numerico: parseBrazilianNumber(row[4]),
      valor_unitario_numerico: parseBrazilianNumber(row[5]),
      valor_total_numerico: parseBrazilianNumber(row[6]),
      linha_original: [...row],
    }];
  });
};

const extractSchedules = (
  table: TableArray,
  page: number,
  tableIndex: number,
): FinancialSchedule[] => {
  const headerIndex = table.findIndex((row) => {
    const header = normalizeForComparison(row.join(' '));
    return hasAll(header, ['ITEM', 'DESCRICAO', 'VALOR (R$)', 'MES 1']);
  });

  if (headerIndex === -1) return [];
  const headers = table[headerIndex];
  const percentageRow = table[headerIndex + 1];
  const valuesRow = table[headerIndex + 2];

  if (!percentageRow || !valuesRow || !/^\d+(?:\.\d+)*$/.test(percentageRow[0]?.trim() ?? '')) {
    return [];
  }

  const periodHeaders = headers.slice(3, -1);
  const percentages = percentageRow.slice(3, 3 + periodHeaders.length);
  const values = valuesRow.slice(0, periodHeaders.length);

  return [{
    pagina_origem: page,
    tabela_origem: tableIndex,
    numero_item: percentageRow[0] ?? '',
    descricao: percentageRow[1] ?? '',
    valor_total: percentageRow[2] ?? '',
    valor_total_numerico: parseBrazilianNumber(percentageRow[2]),
    periodos: periodHeaders.map((period, index) => ({
      periodo: period,
      percentual: percentages[index] ?? '',
      valor: values[index] ?? '',
      percentual_numerico: parseBrazilianNumber(percentages[index]),
      valor_numerico: parseBrazilianNumber(values[index]),
    })),
    linha_percentuais_original: [...percentageRow],
    linha_valores_original: [...valuesRow],
  }];
};

const findOriginalValue = (content: string, label: string) => {
  const match = content.match(new RegExp(`${label}\\s*:?\\s*(R\\$\\s*[\\d.]+,\\d{2})`, 'i'));
  return match?.[1] ?? null;
};

const emptyTotals = (): BudgetTotals => ({
  valor_bdi_total: null,
  valor_orcamento: null,
  valor_total: null,
  valor_bdi_total_numerico: null,
  valor_orcamento_numerico: null,
  valor_total_numerico: null,
});

export const extractStructuredTables = (pages: PageTableResult[]): StructuredTables => {
  const result: StructuredTables = {
    tabelas_originais: [],
    itens_orcamentarios: [],
    composicoes_custo: [],
    cronogramas: [],
    totais_orcamentarios: emptyTotals(),
    avisos_extracao: [],
  };

  for (const page of pages) {
    const pageContent = normalizeForComparison(page.tables.flat(2).join(' '));

    page.tables.forEach((table, zeroBasedIndex) => {
      const tableIndex = zeroBasedIndex + 1;
      const sectionType = classifyTable(table, pageContent);
      const originalTable: OriginalTable = {
        pagina: page.num,
        indice_tabela: tableIndex,
        tipo_secao: sectionType,
        linhas: table.map((row) => [...row]),
      };

      result.tabelas_originais.push(originalTable);

      if (sectionType === 'planilha_orcamentaria') {
        result.itens_orcamentarios.push(...extractBudgetItems(table, page.num, tableIndex));

        const content = table.flat().join('\n');
        const valorBdiTotal = findOriginalValue(content, 'VALOR BDI TOTAL');
        const valorOrcamento = findOriginalValue(content, 'VALOR OR[ÇC]AMENTO');
        const valorTotal = findOriginalValue(content, 'VALOR TOTAL');

        if (valorBdiTotal) result.totais_orcamentarios.valor_bdi_total = valorBdiTotal;
        if (valorOrcamento) result.totais_orcamentarios.valor_orcamento = valorOrcamento;
        if (valorTotal) result.totais_orcamentarios.valor_total = valorTotal;
      }

      if (sectionType === 'composicao_custos') {
        result.composicoes_custo.push(...extractCostCompositions(table, page.num, tableIndex));
      }

      if (sectionType === 'cronograma_fisico_financeiro') {
        result.cronogramas.push(...extractSchedules(table, page.num, tableIndex));
      }
    });
  }

  result.totais_orcamentarios.valor_bdi_total_numerico = parseBrazilianNumber(
    result.totais_orcamentarios.valor_bdi_total ?? undefined,
  );
  result.totais_orcamentarios.valor_orcamento_numerico = parseBrazilianNumber(
    result.totais_orcamentarios.valor_orcamento ?? undefined,
  );
  result.totais_orcamentarios.valor_total_numerico = parseBrazilianNumber(
    result.totais_orcamentarios.valor_total ?? undefined,
  );

  if (result.tabelas_originais.length > 0 && result.itens_orcamentarios.length === 0) {
    result.avisos_extracao.push(
      'Foram encontradas tabelas, mas nenhuma linha de item orcamentario foi reconhecida.',
    );
  }

  for (const item of result.itens_orcamentarios) {
    if (item.validacoes.quantidade_vezes_valor_com_bdi_confere === false) {
      result.avisos_extracao.push(
        `O total do item ${item.numero_item} nao confere com quantidade x valor unitario com BDI.`,
      );
    }
  }

  return result;
};
