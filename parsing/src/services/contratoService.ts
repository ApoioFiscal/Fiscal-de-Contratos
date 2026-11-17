import { parseBrazilianNumber } from './tableParserService';

/**
 * Extrator de dados de TERMOS DE CONTRATO administrativos (Lei 14.133/2021).
 *
 * Premissa de projeto: o texto vem de PDFs com camada de OCR, então vem com ruído
 * ("Nº" vira `N"`, "M2" vira "N42", "R$" vira "Ifj;", "289,00" vira "289,06" etc.).
 * Por isso:
 *  - os padrões de rótulo toleram variações de "nº";
 *  - valores numéricos são reconciliados (quantidade × unitário = total) e os itens
 *    corrigidos geram um aviso para conferência no PDF;
 *  - o que não pôde ser lido com segurança fica `null` e gera um `avisos[]`, em vez de
 *    gravar um valor provavelmente errado.
 */

// ---------------------------------------------------------------- tipos

export type ParteContrato = {
  papel: 'CONTRATANTE' | 'CONTRATADO';
  nome: string | null;
  documento: string | null;
};

/** Leitura interna da vigência; só as datas são expostas na extração. */
type VigenciaInterna = {
  data_inicio: string | null;
  data_fim: string | null;
  calculada: boolean;
};

export type ItemContrato = {
  codigo: number;
  descricao: string;
  unidade: string;
  unidade_original: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

export type DotacaoContrato = {
  unidade_codigo: string;
  unidade: string;
  funcional_programatica: string | null;
  acao: string | null;
  ficha: string | null;
  elemento_codigo: string | null;
  elemento_descricao: string | null;
  natureza_codigo: string | null;
  natureza: string | null;
  complemento: string | null;
};

export type ContratoExtraction = {
  numero_contrato: string | null;
  numero_processo: string | null;
  modalidade: string | null;
  numero_modalidade: string | null;
  objeto: string | null;
  contratante: ParteContrato;
  contratado: ParteContrato;
  vigencia: {
    data_inicio: string | null;
    data_fim: string | null;
  };
  valor_total: number | null;
  itens: ItemContrato[];
  dotacoes: DotacaoContrato[];
  validacoes: {
    soma_itens_confere_total_da_tabela: boolean | null;
    soma_itens_confere_valor_do_contrato: boolean | null;
  };
  avisos: string[];
};

// ---------------------------------------------------------------- utilitários

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** "Nº" aparece como Nº, N°, N", No., N: ... Exige um separador para não casar "NESTE". */
const NUM = String.raw`N\s*(?:[º°"”'.]+\s*:?|:|[oO]\b\.?\s*:?)\s*`;

/**
 * Variante usada só no número do contrato: aceita também "N 045/2026" (sem símbolo),
 * comum quando o OCR perde o "º". O lookahead exige um dígito depois, então "NESTE"
 * continua sem casar.
 */
const NUM_CONTRATO = String.raw`N\s*(?:[º°"”'.]+\s*:?|:|[oO]\b\.?\s*:?|(?=\s*\d))\s*`;

/**
 * Modelos de emissão escrevem "CONTRATO PMM n° 00140 /2026": um qualifier curto entre
 * a palavra CONTRATO e o rótulo do número. Limite de 2 tokens de 2-8 letras para não
 * capturar prosa ("TERMO DE CONTRATO NESTE ATO" continua sem número).
 */
const CONTRATO_NUMERO_PATTERN = new RegExp(
  String.raw`\bCONTRATO\s+(?:[A-Za-zÀ-ÿ]{2,8}\s+){0,2}${NUM_CONTRATO}(\d[\w./-]*(?:\s*/\s*[\w-]+)*)`,
  'i',
);

/** "00140 /2026" (espaço antes da barra, típico de OCR) -> "00140/2026". */
const normalizarNumeroContrato = (raw: string | null | undefined): string | null =>
  clean(raw?.replace(/\s*\/\s*/g, '/').replace(/[.,;:]+$/, ''));

/** Aceita até 4 caracteres de lixo entre o rótulo e o número (ex.: `CNPJ ti" 01.612...`). */
const LABEL_GAP = String.raw`\s*\S{0,4}?\s*`;

const stripAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const flatten = (text: string) =>
  text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clean = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
};

/** Corrige confusões comuns de OCR entre dígito e letra DENTRO de palavras em maiúsculas. */
const fixOcrDigitsInWords = (value: string) =>
  value
    .replace(/(?<=[A-ZÀ-Ý])1(?=[A-ZÀ-Ý])/g, 'I')
    .replace(/(?<=[A-ZÀ-Ý])0(?=[A-ZÀ-Ý])/g, 'O');

const maskCnpj = (digits: string) =>
  digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

const maskCpf = (digits: string) => digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

const CNPJ_DIGITS = String.raw`\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}`;

const findCnpj = (value: string): string | null => {
  // Com rótulo (aceita "CNPJ sob o nº", "CNPJ/MF n°", lixo de OCR) ...
  const labeled = value.match(new RegExp(String.raw`CNPJ(?:\/MF)?[^\d]{0,25}?(${CNPJ_DIGITS})`, 'i'));
  if (labeled) return maskCnpj(labeled[1].replace(/\D/g, ''));
  // ... ou o primeiro número com máscara de CNPJ, mesmo sem rótulo legível.
  const bare = value.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  return bare ? maskCnpj(bare[1].replace(/\D/g, '')) : null;
};

const findCpf = (value: string): string | null => {
  const match = value.match(
    new RegExp(String.raw`CPF${LABEL_GAP}(\d{3}\.?\d{3}\.?\d{3}-?\d{2})`, 'i'),
  );
  return match ? maskCpf(match[1].replace(/\D/g, '')) : null;
};

const toIso = (day: number, month: number, year: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const monthNumber = (name: string): number | null => MESES[stripAccents(name).toLowerCase()] ?? null;

const addToIso = (iso: string, amount: number, unit: 'dias' | 'meses' | 'anos'): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (unit === 'dias') date.setUTCDate(date.getUTCDate() + amount);
  if (unit === 'meses') date.setUTCMonth(date.getUTCMonth() + amount);
  if (unit === 'anos') date.setUTCFullYear(date.getUTCFullYear() + amount);
  return date.toISOString().slice(0, 10);
};

const sameMoney = (left: number, right: number) => Math.abs(left - right) < 0.005;

/** Texto entre dois marcadores de cláusula (início inclusivo no fim do marcador). */
const sliceBetween = (text: string, start: RegExp, end: RegExp): string | null => {
  const startMatch = start.exec(text);
  if (!startMatch) return null;
  const from = startMatch.index + startMatch[0].length;
  const rest = text.slice(from);
  const endMatch = end.exec(rest);
  return endMatch ? rest.slice(0, endMatch.index) : rest;
};

// ---------------------------------------------------------------- detecção

const HEAD_SIZE = 1500;

/**
 * Editais e afins costumam trazer a minuta do contrato inteira nos anexos — com
 * "CONTRATANTE"/"CONTRATADO" e todas as cláusulas. Sem esta guarda, o edital seria
 * classificado como contrato (ver `edital com minuta anexa` nos testes).
 */
const HEAD_MARKS_OTHER_DOCUMENT =
  /^\s*(?:\d+[.)]\s*)?(?:EDITAL|AVISO\s+DE\s+(?:LICITA[ÇC][ÃA]O|PREG[ÃA]O)|TERMO\s+DE\s+REFER[ÊE]NCIA|PREG[ÃA]O\s+(?:ELETR[ÔO]NICO|PRESENCIAL))/i;
const MENTIONS_MINUTA = /MINUTA\s+(?:DE|DO)\s+(?:TERMO\s+DE\s+)?CONTRATO/i;

export const isContrato = (text: string): boolean => {
  const headStart = text.slice(0, 400);
  const head = text.slice(0, HEAD_SIZE);
  const flat = flatten(text);

  if (HEAD_MARKS_OTHER_DOCUMENT.test(headStart) || MENTIONS_MINUTA.test(head)) return false;

  const hasTitle = /TERMO\s+DE\s+CONTRATO/i.test(head) || CONTRATO_NUMERO_PATTERN.test(head);
  const hasParties =
    new RegExp(MARK_CONTRATANTE, 'i').test(flat) && new RegExp(MARK_CONTRATADO, 'i').test(flat);
  const clauseCount = (flat.match(/CL[ÁA]USULA\s+/gi) ?? []).length;

  return (hasTitle || hasParties) && clauseCount >= 3;
};

// ---------------------------------------------------------------- partes e pessoas

const STREET_START =
  /^(RUA|R\.|AV\.?|AVENIDA|TRAVESSA|TV\.|ALAMEDA|PRA[ÇC]A|ESTRADA|RODOVIA|S[ÍI]TIO|FAZENDA|LOTEAMENTO|DISTRITO|POVOADO|QUADRA|CONJUNTO|BR-?\d|PB-?\d)\b/i;

/** Separa "NOME - ENDEREÇO" no primeiro " - " seguido de logradouro; senão, no primeiro " - ". */
const splitNomeEndereco = (value: string): { nome: string | null; endereco: string | null } => {
  const separator = /\s+-\s+/g;
  let fallback: number | null = null;
  let match: RegExpExecArray | null;

  while ((match = separator.exec(value)) !== null) {
    if (fallback === null) fallback = match.index;
    const rest = value.slice(match.index + match[0].length);
    if (STREET_START.test(rest)) {
      return { nome: clean(value.slice(0, match.index)), endereco: clean(rest) };
    }
  }

  if (fallback !== null) {
    const sepLength = (value.slice(fallback).match(/^\s+-\s+/) ?? [' - '])[0].length;
    return { nome: clean(value.slice(0, fallback)), endereco: clean(value.slice(fallback + sepLength)) };
  }

  return { nome: clean(value), endereco: null };
};

const parseParte = (papel: ParteContrato['papel'], clause: string | null): ParteContrato => {
  const empty: ParteContrato = { papel, nome: null, documento: null };
  if (!clause) return empty;

  // Tudo depois de "neste ato representado por" é a qualificação do representante,
  // que não faz mais parte do contrato. Corta para não capturar o CPF dele como documento.
  const head = clause.split(
    /,?\s*neste\s+ato\s+representad[oa]s?\s+(?:pel[oa]s?|por)\s+/i,
  )[0];

  const cnpj = findCnpj(head);
  const cpf = cnpj ? null : findCpf(head);
  const withoutDocument = head
    .replace(/,?\s*(?:inscrit[oa]\s+(?:no|sob)\s+(?:o\s+)?)?(?:CNPJ|CPF)\b.*$/i, '')
    .replace(/,?\s*com\s+sede\s+(?:na|no|em)\b.*$/i, '')
    .replace(/^\s*(?:a|o)\s+(?:empresa|pessoa\s+jur[íi]dica|munic[íi]pio\s+de)\s+(?=\S)/i, (m) =>
      /munic/i.test(m) ? 'Município de ' : '',
    )
    .replace(/^\s*(?:de\s+(?:um|outro)\s+lado|do\s+outro\s+lado|e)\s+/i, '');
  const { nome } = splitNomeEndereco(withoutDocument);

  return {
    papel,
    nome: nome ? fixOcrDigitsInWords(nome) : null,
    documento: cnpj ?? cpf,
  };
};


// ---------------------------------------------------------------- localização das partes

const DORAVANTE = String.raw`(?:,?\s*(?:doravante|daqui\s+por\s+diante|a\s+seguir)\s+(?:simplesmente\s+|denominad[oa]\s+|designad[oa]\s+|chamad[oa]\s+|apenas\s+)?(?:de\s+|como\s+)?)`;
const MARK_CONTRATANTE = String.raw`${DORAVANTE}["“”']?CONTRATANTE`;
const MARK_CONTRATADO = String.raw`${DORAVANTE}["“”']?CONTRATAD[O0A]`;

/**
 * Localiza o trecho de qualificação de cada parte. Tenta, em ordem:
 *  1) "de um lado <X> doravante (simplesmente|denominado) CONTRATANTE ... de/do outro (lado) <Y> doravante ... CONTRATADO"
 *  2) o mesmo, sem "de um lado"/"do outro lado", usando só o marcador "doravante ... CONTRATANTE/CONTRATADO"
 *  3) rótulos "CONTRATANTE: <X>." e "CONTRATADA: <Y>."
 */
const locatePartyClauses = (flat: string): { contratanteClause: string | null; contratadoClause: string | null } => {
  const reContratado = new RegExp(
    String.raw`(?:(?:e\s+)?d[eo]\s+outro(?:\s+lado)?|e)\s+(.+?)\s*${MARK_CONTRATADO}`,
    'i',
  );

  let contratanteClause: string | null = null;
  let contratadoClause: string | null = null;

  // Âncora no "de um lado": evita que o preâmbulo ("Pelo presente instrumento...") entre no nome.
  const lado1 = flat.match(new RegExp(String.raw`de\s+um\s+lado\s+(.+?)\s*${MARK_CONTRATANTE}`, 'i'));
  contratanteClause = lado1?.[1] ?? null;

  if (!contratanteClause) {
    const idx = flat.search(new RegExp(MARK_CONTRATANTE, 'i'));
    if (idx !== -1) {
      const before = flat.slice(Math.max(0, idx - 500), idx);
      contratanteClause = before.split(/\b(?:Pelo\s+presente|celebram|firmam|Entre)\b[^,.]*[,:.]?/i).pop()?.trim() || null;
    }
  }

  const afterContratante = (() => {
    const m = new RegExp(MARK_CONTRATANTE, 'i').exec(flat);
    return m ? flat.slice(m.index + m[0].length) : flat;
  })();

  const lado2 = afterContratante.match(
    new RegExp(String.raw`(?:e\s+)?d[eo]\s+outro(?:\s+lado)?\s+(.+?)\s*${MARK_CONTRATADO}`, 'i'),
  );
  contratadoClause = lado2?.[1] ?? null;

  if (!contratadoClause) {
    const m = afterContratante.match(reContratado);
    contratadoClause = m?.[1] ?? null;
  }

  // 3) Formato com rótulos "CONTRATANTE: ..." / "CONTRATADA: ..."
  if (!contratanteClause) {
    contratanteClause = flat.match(/CONTRATANTE\s*:\s*(.+?)(?=\s+CONTRATAD[OA]\s*:|\s+CL[ÁA]USULA|$)/i)?.[1] ?? null;
  }
  if (!contratadoClause) {
    contratadoClause = flat.match(/CONTRATAD[OA]\s*:\s*(.+?)(?=\s+CL[ÁA]USULA|\s+Pelo\s+presente|$)/i)?.[1] ?? null;
  }

  return { contratanteClause, contratadoClause };
};

/** Prefeitura de títulos como "...CELEBRAM A PREFEITURA MUNICIPAL DE X E <FORNECEDOR>, PARA ...". */
const titleParties = (flat: string): { contratante: string | null; contratado: string | null } => {
  const head = flat.slice(0, HEAD_SIZE);
  const m = head.match(
    /CELEBRAM\s+(?:A\s+|O\s+)?((?:PREFEITURA|MUNIC[ÍI]PIO|C[ÂA]MARA|FUNDO|SECRETARIA)[^,]*?)\s+E\s+(.+?)(?=\s*[,.:]|\s+PARA\b|\s+TENDO\b|\s+COM\s+O\s+OBJETO|\s+Pelo\s+presente\b|\s+CL[ÁA]USULA\b|\s+CNPJ\b|$)/i,
  );
  const limit = (v: string | null) => (v && v.length <= 150 ? v : null);
  return { contratante: limit(clean(m?.[1])), contratado: limit(clean(m?.[2])) };
};

const normName = (value: string | null) => stripAccents(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Completa o que a qualificação das partes não entregou (OCR ruim ou redação fora do padrão):
 *  - nome do contratante/contratado a partir do título do termo;
 *  - CNPJ do contratado: o primeiro CNPJ do documento que não seja o do contratante.
 */
const fillParteFallbacks = (
  parte: ParteContrato,
  flat: string,
  papel: ParteContrato['papel'],
  contratante?: ParteContrato,
): ParteContrato => {
  const filled = { ...parte };
  const title = titleParties(flat);

  if (!filled.nome) {
    const fromTitle = papel === 'CONTRATANTE' ? title.contratante : title.contratado;
    if (fromTitle) filled.nome = fixOcrDigitsInWords(fromTitle);
  }

  // O 1º CNPJ do documento costuma ser o da prefeitura (contratante). Preenchendo
  // aqui, o fallback do contratado consegue escolher o CNPJ que não é esse.
  if (papel === 'CONTRATANTE' && !filled.documento) {
    const all = [...flat.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)].map((m) => m[1]);
    if (all.length > 0) filled.documento = all[0];
  }

  if (papel === 'CONTRATADO' && !filled.documento) {
    const all = [...flat.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)].map((m) => m[1]);
    const other = all.find((cnpj) => cnpj !== contratante?.documento);
    if (other) filled.documento = other;
  }

  // Nome do contratado igual ao da prefeitura é sinal de captura errada.
  if (papel === 'CONTRATADO' && contratante?.nome && normName(filled.nome) === normName(contratante.nome)) {
    filled.nome = title.contratado ? fixOcrDigitsInWords(title.contratado) : null;
  }

  return filled;
};

// ---------------------------------------------------------------- identificação

const extractNumeroContrato = (text: string): string | null => {
  const raw =
    CONTRATO_NUMERO_PATTERN.exec(text.slice(0, HEAD_SIZE))?.[1] ??
    CONTRATO_NUMERO_PATTERN.exec(text)?.[1];
  return normalizarNumeroContrato(raw);
};

const extractNumeroProcesso = (text: string): string | null => {
  const pattern = new RegExp(
    String.raw`PROCESSO(?:\s+(?:ADMINISTRATIVO|LICITAT[ÓO]RIO|DE\s+COMPRA))?\s+${NUM}([\w./-]+)`,
    'i',
  );
  return clean(text.slice(0, HEAD_SIZE).match(pattern)?.[1]) ?? clean(text.match(pattern)?.[1]);
};

const MODALIDADE_LABEL: Array<[RegExp, string]> = [
  [/^DISPENSA/i, 'Dispensa de Licitação'],
  [/^INEXIGIBILIDADE/i, 'Inexigibilidade de Licitação'],
  [/^PREG[ÃA]O\s+ELETR[ÔO]NICO/i, 'Pregão Eletrônico'],
  [/^PREG[ÃA]O\s+PRESENCIAL/i, 'Pregão Presencial'],
  [/^PREG[ÃA]O/i, 'Pregão'],
  [/^CONCORR[ÊE]NCIA/i, 'Concorrência'],
  [/^TOMADA\s+DE\s+PRE[ÇC]OS/i, 'Tomada de Preços'],
  [/^CONVITE/i, 'Convite'],
  [/^ADES[ÃA]O/i, 'Adesão a Ata de Registro de Preços'],
];

const extractModalidade = (text: string): { modalidade: string | null; numero: string | null } => {
  const head = text.slice(0, HEAD_SIZE);
  const headerPattern = new RegExp(
    String.raw`^\s*(DISPENSA|INEXIGIBILIDADE|PREG[ÃA]O(?:\s+(?:ELETR[ÔO]NICO|PRESENCIAL))?|CONCORR[ÊE]NCIA|TOMADA\s+DE\s+PRE[ÇC]OS|CONVITE|ADES[ÃA]O)(?:\s+DE\s+(?:LICITA[ÇC][ÃA]O|VALOR))?\s+${NUM}([\w./-]+)`,
    'im',
  );
  const header = head.match(headerPattern);
  if (!header) return { modalidade: null, numero: null };

  const label = MODALIDADE_LABEL.find(([pattern]) => pattern.test(header[1]))?.[1] ?? clean(header[1]);
  return { modalidade: label, numero: clean(header[2]) };
};

const extractObjeto = (text: string): string | null => {
  const match = text.match(
    /tem\s+por\s+objeto\s*:?\s*([\s\S]+?)(?=\n\s*O\s+(?:fornecimento|presente)\b|\n\s*CL[ÁA]USULA\b|\n\s*\n)/i,
  );
  return clean(match?.[1]);
};

// ---------------------------------------------------------------- itens

const MONEY_GARBLED = String.raw`[\d.]+,\d[\d()OolI|]{0,2}`;
// <descrição opcional> <unidade> <qtd> <unitário> <total>. A unidade é sempre o 4º token a partir do
// fim e começa em fronteira de palavra (nunca corta "RESMA" em "R" + "ESMA").
const ITEM_TAIL = new RegExp(
  String.raw`^(?:(.*?)\s+)?(\S{1,10})\s+(\d{1,6}(?:,\d{1,3})?)\s+(${MONEY_GARBLED})\s+(${MONEY_GARBLED})\s*$`,
);

const normalizeUnidade = (raw: string): { valor: string; suspeito: boolean } => {
  const compact = raw.replace(/[^\p{L}\p{N}²³]/gu, '').toUpperCase();

  // M2 / M² são grafias normais de m². Já N2, M42, N42 são ruído de OCR (M↔N, "4" injetado).
  if (/^[MN]4?[2²]$/.test(compact)) return { valor: 'm²', suspeito: !/^M[2²]$/.test(compact) };
  if (/^[MN]4?[3³]$/.test(compact)) return { valor: 'm³', suspeito: !/^M[3³]$/.test(compact) };

  const known: Record<string, string> = {
    UN: 'Un', UND: 'Un', UNO: 'Un', UNID: 'Un', UNIDADE: 'Un', CX: 'Cx', CAIXA: 'Cx', KG: 'Kg',
    L: 'L', LT: 'L', LTS: 'L', M: 'm', ML: 'm', PCT: 'Pct', PC: 'Pct', PAR: 'Par',
    SACO: 'Saco', SC: 'Saco', RESMA: 'Resma',
  };
  return { valor: known[compact] ?? raw.trim(), suspeito: false };
};

/**
 * Quando o OCR quebra a cauda da tabela em várias linhas:
 *   UNO 01 R$
 *   191.020,00
 *   R$
 *   191.020,00
 * a 1ª traz unidade + quantidade, e as 2 linhas monetárias seguintes são unitário e total.
 */
const TAIL_PREFIX = new RegExp(
  String.raw`^(?:(.*?)\s+)?(\S{1,10})\s+(\d{1,6}(?:,\d{1,3})?)\s*,?\s*(?:R\$)?\s*$`,
  'i',
);
/**
 * Variante tolerante para a cauda na mesma linha quando o OCR corrompe um dos montantes
 * (ex.: `und 200 5,86 1.172,0-6`). O valor ilegível volta `null` do parse e o
 * reconcile recalcula a partir da quantidade × unitário, sem inventar o total lido.
 */
const ITEM_TAIL_LOOSE = new RegExp(
  String.raw`^(?:(.*?)\s+)?(\S{1,10})\s+(\d{1,6}(?:,\d{1,3})?)\s+(${MONEY_GARBLED})\s+([\d.]+,[\dOolI|()\-.,]{1,4})\s*$`,
);
const MONEY_LINE = /^\s*[R$_.()\-\s]*(\d[\d.]*,\d{2})[_.()\-\s]*$/;
const DECORATION_LINE = /^\s*(?:R\$|[_.\-]+)\s*$/i;
const HEADER_FRAGMENT =
  /QUANT\.?\s+PRE[ÇC]O|^\s*(?:UNIT[ÁA]RIO\.?|PRE[ÇC]O(?:\s+TOTAL)?\.?|\/FABRICANTE|N[\"º°']?\s+DESCRI[ÇC][ÃA]O)\s*$/i;

type ItemTail = { unidade: string; quantidade: string; unitario: string; total: string };

type TailMatch = { desc: string | null; tail: ItemTail; consumed: number };

const matchItemTail = (content: string, lines: string[], index: number): TailMatch | null => {
  const mesmaLinha = content.match(ITEM_TAIL) ?? content.match(ITEM_TAIL_LOOSE);
  if (mesmaLinha) {
    return {
      desc: mesmaLinha[1]?.trim() || null,
      tail: {
        unidade: mesmaLinha[2],
        quantidade: mesmaLinha[3],
        unitario: mesmaLinha[4],
        total: mesmaLinha[5],
      },
      consumed: 1,
    };
  }

  const prefixo = content.match(TAIL_PREFIX);
  if (!prefixo) return null;

  const montantes: string[] = [];
  let consumed = 1;
  for (let j = index + 1; j < Math.min(lines.length, index + 8) && montantes.length < 2; j += 1) {
    const proxima = lines[j];
    if (DECORATION_LINE.test(proxima)) {
      consumed += 1;
      continue;
    }
    const valor = proxima.match(MONEY_LINE)?.[1];
    if (!valor) break;
    montantes.push(valor);
    consumed += 1;
  }
  if (montantes.length < 2) return null;

  return {
    desc: prefixo[1]?.trim() || null,
    tail: {
      unidade: prefixo[2],
      quantidade: prefixo[3],
      unitario: montantes[0],
      total: montantes[1],
    },
    consumed,
  };
};

/** Encontra o início da tabela, inclusive quando o cabeçalho vem quebrado em várias linhas. */
const findTableStart = (lines: string[]): number => {
  const direto = lines.findIndex((line) => /C[ÓO]DIGO/i.test(line) && /DISCRIMINA/i.test(line));
  if (direto !== -1) return direto;

  return lines.findIndex((line, index) => {
    if (!/DESCRI[ÇC][ÃA]O|DISCRIMINA/i.test(line)) return false;
    const janela = lines.slice(index, index + 5).join(' ');
    return /QUANT|QTD|PRE[ÇC]O|P\.?\s*UNIT|UNID/i.test(janela);
  });
};

type RawRow = {
  codigo: number;
  descLines: string[];
  tail: ItemTail | null;
};

const locateItemRows = (lines: string[]): { rows: RawRow[]; totalTabela: number | null } => {
  const start = findTableStart(lines);
  if (start === -1) return { rows: [], totalTabela: null };

  const rows: RawRow[] = [];
  let current: RawRow | null = null;
  let pendente: string[] = [];
  let emTituloLote = false;
  let expected = 1;
  let totalTabela: number | null = null;

  for (let i = start + 1; i < lines.length; ) {
    const line = lines[i];

    const totalMatch = line.match(/^(?:_?\s*)?(?:Total|VALOR TOTAL DOS LOTES)\s*:\s*(.+)$/i);
    if (totalMatch) {
      totalTabela = parseBrazilianNumber(totalMatch[1].trim());
      break;
    }

    // Lote reinicia a numeração e não é descrição de item.
    if (/^\s*LOTE\s+\d/i.test(line)) {
      pendente = [];
      expected = 1;
      emTituloLote = true;
      i += 1;
      continue;
    }
    // O título do lote pode virar duas linhas quando o OCR quebra antes do ")".
    if (emTituloLote) {
      if (!/^\d/.test(line) && /\)\s*$/.test(line)) {
        i += 1;
        continue;
      }
      emTituloLote = false;
    }
    // "TOTAL" e "I" soltos são sobras do cabeçalho quebrado, antes de qualquer item.
    if (
      HEADER_FRAGMENT.test(line) ||
      (rows.length === 0 && /^\s*(?:TOTAL|I)\s*$/i.test(line)) ||
      /^(?:www\.|refe|CNPJ:\s*01)/i.test(line)
    ) {
      i += 1;
      continue;
    }

    let content = line;
    const startMatch = line.match(/^(\d{1,3})(?:\s+(.*))?$/);
    const codigoLido = startMatch ? Number(startMatch[1]) : null;
    // O OCR costuma perder um código (1, 3, 4...). Aceita qualquer número próximo do
    // esperado para não transformar os itens seguintes em descrição do anterior.
    const startsRow =
      codigoLido !== null &&
      codigoLido >= expected &&
      codigoLido <= expected + 2 &&
      (!current || current.tail !== null || Boolean(startMatch?.[2]?.trim()));

    if (startMatch && startsRow) {
      current = { codigo: codigoLido!, descLines: [...pendente], tail: null };
      rows.push(current);
      expected = codigoLido! + 1;
      content = startMatch[2] ?? '';
      pendente = [];
    }

    if (!content.trim()) {
      i += 1;
      continue;
    }

    const found = matchItemTail(content, lines, i);
    if (found) {
      // Se o item anterior já fechou, esta cauda pertence a um novo item (código perdido no OCR).
      if (!current || current.tail) {
        current = { codigo: expected, descLines: [...pendente], tail: null };
        rows.push(current);
        expected += 1;
      }
      if (found.desc) current.descLines.push(found.desc);
      current.tail = found.tail;
      pendente = [];
      i += found.consumed;
      continue;
    }

    if (current && !current.tail) current.descLines.push(content.trim());
    else pendente.push(content.trim());
    i += 1;
  }

  return { rows, totalTabela };
};

/**
 * Quando o OCR lê uma palavra solta (com `/` ou similar colado) ANTES de um parágrafo de várias
 * linhas, ela é, na prática, a primeira palavra da 2ª linha visual da célula
 * ("/GALVANIZADA" + "…METÁLICA" + "COM INSTALAÇÃO…" => "…METÁLICA GALVANIZADA COM INSTALAÇÃO…").
 */
const buildDescricao = (descLines: string[]): { descricao: string; reordenada: boolean } => {
  const lines = [...descLines];
  const first = lines[0] ?? '';
  let reordenada = false;

  if (lines.length >= 3 && /^[^\p{L}\p{N}]+[\p{L}]+$/u.test(first)) {
    const displaced = first.replace(/^[^\p{L}\p{N}]+/u, '');
    lines.splice(0, 1);
    lines.splice(1, 0, displaced);
    reordenada = true;
  }

  return {
    descricao: clean(lines.join(' ').replace(/^[^\p{L}\p{N}]+/u, '')) ?? '',
    reordenada,
  };
};

const reconcileItems = (
  rows: RawRow[],
): { itens: ItemContrato[]; avisos: string[]; corrigidos: number } => {
  const itens: ItemContrato[] = [];
  const avisos: string[] = [];
  let corrigidos = 0;

  for (const row of rows) {
    if (!row.tail) {
      avisos.push(`Item ${row.codigo}: não foi possível ler quantidade e valores; preencha manualmente.`);
      continue;
    }

    let ajustado = false;
    const quantidade = parseBrazilianNumber(row.tail.quantidade);
    let unitario = parseBrazilianNumber(row.tail.unitario);
    let total = parseBrazilianNumber(row.tail.total);

    if (quantidade === null || quantidade <= 0) {
      avisos.push(`Item ${row.codigo}: quantidade ilegível; preencha manualmente.`);
      continue;
    }

    if (unitario !== null && total !== null) {
      if (!sameMoney(quantidade * unitario, total)) {
        // Total legível e unitário inconsistente: refaz o unitário a partir do total.
        const derived = Math.round((total / quantidade) * 100) / 100;
        if (sameMoney(derived * quantidade, total)) {
          unitario = derived;
        } else {
          total = Math.round(quantidade * unitario * 100) / 100;
        }
        ajustado = true;
      }
    } else if (unitario !== null && total === null) {
      total = Math.round(quantidade * unitario * 100) / 100;
      ajustado = true;
    } else if (unitario === null && total !== null) {
      unitario = Math.round((total / quantidade) * 100) / 100;
      ajustado = true;
    } else {
      avisos.push(`Item ${row.codigo}: valores ilegíveis; preencha manualmente.`);
      continue;
    }

    const { descricao, reordenada } = buildDescricao(row.descLines);
    if (reordenada) ajustado = true;

    const { valor: unidade, suspeito } = normalizeUnidade(row.tail.unidade);

    if (suspeito) ajustado = true;
    if (ajustado) corrigidos++;

    itens.push({
      codigo: row.codigo,
      descricao,
      unidade,
      unidade_original: row.tail.unidade,
      quantidade,
      valor_unitario: unitario as number,
      valor_total: total as number,
    });
  }

  return { itens, avisos, corrigidos };
};

// ---------------------------------------------------------------- dotação

const extractDotacoes = (lines: string[]): DotacaoContrato[] => {
  const startIndex = lines.findIndex((line) => /CL[ÁA]USULA.*DA\s+DOTA[ÇC][ÃA]O/i.test(line));
  if (startIndex === -1) return [];

  const dotacoes: DotacaoContrato[] = [];
  let current: DotacaoContrato | null = null;
  let collectingComplemento = false;

  for (const line of lines.slice(startIndex + 1)) {
    if (/^CL[ÁA]USULA\b/i.test(line)) break;

    const unidade = line.match(/^(\d{2}\.\d{3})\s+(.+)$/);
    if (unidade) {
      current = {
        unidade_codigo: unidade[1],
        unidade: unidade[2].trim(),
        funcional_programatica: null,
        acao: null,
        ficha: null,
        elemento_codigo: null,
        elemento_descricao: null,
        natureza_codigo: null,
        natureza: null,
        complemento: null,
      };
      dotacoes.push(current);
      collectingComplemento = false;
      continue;
    }

    if (!current) continue;

    const funcional = line.match(/^(\d{2}\s\d{3}\s\d{4}\s\d{4})\s+(.+)$/);
    const elemento = line.match(/^(\d{4,6})\s+(\d{4}\.\d{2,4})\s+(.+)$/);
    const natureza = line.match(/^(\d{4}\.\d{2})\s*[—–-]\s*(.+)$/);

    if (funcional) {
      current.funcional_programatica = funcional[1];
      current.acao = funcional[2].trim();
      collectingComplemento = false;
    } else if (elemento) {
      current.ficha = elemento[1];
      current.elemento_codigo = elemento[2];
      current.elemento_descricao = elemento[3].trim();
      collectingComplemento = false;
    } else if (natureza) {
      current.natureza_codigo = natureza[1];
      current.natureza = clean(natureza[2].replace(/\s*[—–]\s*/g, ' - '));
      collectingComplemento = false;
    } else if (/^Objetivo\s*:/i.test(line)) {
      current.complemento = line.trim();
      collectingComplemento = true;
    } else if (collectingComplemento) {
      current.complemento = `${current.complemento} ${line.trim()}`;
    }
  }

  return dotacoes;
};

// ---------------------------------------------------------------- assinaturas

/** A data do bloco de assinatura é usada apenas como fallback da vigência. */
const extractDataAssinatura = (flat: string): string | null => {
  const local = flat.match(
    /([A-ZÀ-Ý][\p{L}]+(?:\s+[\p{L}]+){0,3})\s*-\s*([A-Z]{2})\s*,\s*(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})/u,
  );
  if (!local) return null;

  const month = monthNumber(local[4]);
  return month ? toIso(Number(local[3]), month, Number(local[5])) : null;
};

// ---------------------------------------------------------------- vigência

const PRAZO_VIGENCIA_HEADING = /CL[ÁA]USULA\s+[\p{L}ÁÉÍÓÚÂÊÔÃÕÇ ]+?\s*-\s*DO\s+PRAZO\s+E\s+DA\s+VIG[ÊE]NCIA\s*:/iu;
const NEXT_CLAUSE = /CL[ÁA]USULA\s+/i;

/** A cláusula de prazo/vigência; evita capturar "vigência" citada na cláusula de reajuste. */
const prazoVigenciaClause = (flat: string): string =>
  sliceBetween(flat, PRAZO_VIGENCIA_HEADING, NEXT_CLAUSE) ?? flat;

const extractVigencia = (
  rawFlat: string,
  dataAssinatura: string | null,
): VigenciaInterna => {
  const flat = prazoVigenciaClause(rawFlat);
  const trecho = clean(flat.match(/vig[êe]ncia[^;]{0,200}/i)?.[0]);

  const dataExtenso = flat.match(
    /vig[êe]ncia[^.]{0,160}?at[ée]\s+(?:o\s+dia\s+)?(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})/iu,
  );
  const dataNumerica = flat.match(/vig[êe]ncia[^.]{0,160}?at[ée]\s+(?:o\s+dia\s+)?(\d{2})\/(\d{2})\/(\d{4})/i);
  const duracao = flat.match(
    /vig[êe]ncia[^.]{0,120}?(\d{1,3})\s*(?:\([^)]*\)\s*)?(meses|m[êe]s|dias|anos?)\b/i,
  );

  const iniciaNaAssinatura = /data\s+de\s+sua\s+assinatura/i.test(trecho ?? '') || /da\s+assinatura/i.test(trecho ?? '');
  const dataInicio = iniciaNaAssinatura ? dataAssinatura : null;

  let dataFim: string | null = null;
  let calculada = false;

  if (dataExtenso) {
    const month = monthNumber(dataExtenso[2]);
    if (month) dataFim = toIso(Number(dataExtenso[1]), month, Number(dataExtenso[3]));
  } else if (dataNumerica) {
    dataFim = toIso(Number(dataNumerica[1]), Number(dataNumerica[2]), Number(dataNumerica[3]));
  } else if (duracao && dataInicio) {
    const amount = Number(duracao[1]);
    const unitRaw = duracao[2].toLowerCase();
    const unit = unitRaw.startsWith('dia') ? 'dias' : unitRaw.startsWith('an') ? 'anos' : 'meses';
    // Lei 14.133/2021, art. 183: exclui-se o dia do começo e inclui-se o do vencimento.
    dataFim = addToIso(dataInicio, amount, unit);
    calculada = true;
  }

  return { data_inicio: dataInicio, data_fim: dataFim, calculada };
};

const extractValorTotal = (flat: string): number | null => {
  const match =
    flat.match(/valor\s+total\s+(?:deste|do)\s+contrato[^\d]{0,60}?(\d{1,3}(?:\.\d{3})*,\d{2})/i) ??
    flat.match(/valor\s+global\s+de[^\d]{0,30}?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  return match ? parseBrazilianNumber(match[1]) : null;
};

// ---------------------------------------------------------------- orquestração

export const extractContrato = (text: string): ContratoExtraction => {
  const avisos: string[] = [];
  const flat = flatten(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line));

  // Partes
  const { contratanteClause, contratadoClause } = locatePartyClauses(flat);

  const contratante = fillParteFallbacks(
    parseParte('CONTRATANTE', contratanteClause), flat, 'CONTRATANTE',
  );
  const contratado = fillParteFallbacks(parseParte('CONTRATADO', contratadoClause), flat, 'CONTRATADO', contratante);

  // Identificação
  const { modalidade, numero: numeroModalidade } = extractModalidade(text);
  const numeroContrato = extractNumeroContrato(text);
  const numeroProcesso = extractNumeroProcesso(text);

  // Vigência (a data da assinatura é usada internamente como fallback)
  const vigencia = extractVigencia(flat, extractDataAssinatura(flat));

  // Itens e valores
  const { rows, totalTabela } = locateItemRows(lines);
  const reconciled = reconcileItems(rows);
  const valorTotal = extractValorTotal(flat) ?? totalTabela;
  const somaItens = Math.round(reconciled.itens.reduce((sum, item) => sum + item.valor_total, 0) * 100) / 100;

  const validacoes = {
    soma_itens_confere_total_da_tabela:
      totalTabela !== null && reconciled.itens.length > 0 ? sameMoney(somaItens, totalTabela) : null,
    soma_itens_confere_valor_do_contrato:
      valorTotal !== null && reconciled.itens.length > 0 ? sameMoney(somaItens, valorTotal) : null,
  };

  avisos.push(...reconciled.avisos);

  if (reconciled.itens.length === 0) avisos.push('Nenhum item foi reconhecido na tabela de preços.');
  if (validacoes.soma_itens_confere_valor_do_contrato === false) {
    avisos.push(
      `A soma dos itens (${somaItens.toFixed(2)}) não confere com o valor do contrato (${valorTotal?.toFixed(2)}): revise os itens.`,
    );
  }

  const corrigidos = reconciled.corrigidos;
  if (corrigidos > 0) {
    avisos.push(
      `${corrigidos} item(ns) tiveram valor, unidade ou descrição ajustados por conflito de OCR: confira com o PDF.`,
    );
  }

  const objeto = extractObjeto(text);
  if (objeto && /\.\s*,/.test(objeto)) {
    avisos.push('O objeto contém trecho com ruído de OCR (pontuação solta): revise o texto.');
  }

  if (!numeroContrato) avisos.push('Número do contrato não localizado.');
  if (!numeroProcesso) avisos.push('Número do processo não localizado.');
  if (!contratante.nome || !contratado.nome) avisos.push('Não foi possível identificar todas as partes do contrato.');
  if (!vigencia.data_fim) avisos.push('Data final da vigência não localizada.');
  if (vigencia.calculada) {
    avisos.push('A data final da vigência foi calculada a partir do prazo informado no contrato: confira.');
  }

  return {
    numero_contrato: numeroContrato,
    numero_processo: numeroProcesso,
    modalidade,
    numero_modalidade: numeroModalidade,
    objeto,
    contratante,
    contratado,
    vigencia: { data_inicio: vigencia.data_inicio, data_fim: vigencia.data_fim },
    valor_total: valorTotal,
    itens: reconciled.itens,
    dotacoes: extractDotacoes(lines),
    validacoes,
    avisos,
  };
};

const formatBrl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatIsoBr = (iso: string) => iso.split('-').reverse().join('/');

export const buildContratoSummary = (contrato: ContratoExtraction): string => {
  const parts: string[] = [];

  parts.push(`Contrato ${contrato.numero_contrato ?? 's/n'}`);
  if (contrato.modalidade) {
    parts.push(`${contrato.modalidade}${contrato.numero_modalidade ? ` ${contrato.numero_modalidade}` : ''}`);
  }
  if (contrato.numero_processo) parts.push(`processo ${contrato.numero_processo}`);
  if (contrato.contratante.nome && contrato.contratado.nome) {
    parts.push(`${contrato.contratante.nome} × ${contrato.contratado.nome}`);
  }
  if (contrato.valor_total !== null) parts.push(`valor ${formatBrl(contrato.valor_total)}`);
  parts.push(`${contrato.itens.length} ${contrato.itens.length === 1 ? 'item' : 'itens'}`);
  if (contrato.vigencia.data_fim) parts.push(`vigência até ${formatIsoBr(contrato.vigencia.data_fim)}`);

  return `${parts.join(', ')}.`;
};
