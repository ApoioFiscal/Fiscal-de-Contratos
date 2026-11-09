import { parseBrazilianNumber } from './tableParserService';

/**
 * Extrator de dados de TERMOS DE CONTRATO administrativos (Lei 14.133/2021).
 *
 * Premissa de projeto: o texto vem de PDFs com camada de OCR, então vem com ruído
 * ("Nº" vira `N"`, "M2" vira "N42", "R$" vira "Ifj;", "289,00" vira "289,06" etc.).
 * Por isso:
 *  - os padrões de rótulo toleram variações de "nº";
 *  - valores numéricos são reconciliados (quantidade × unitário = total) e os itens
 *    corrigidos são identificados em `correcoes`;
 *  - o que não pôde ser lido com segurança fica `null` e gera um `avisos[]`, em vez de
 *    gravar um valor provavelmente errado.
 */

// ---------------------------------------------------------------- tipos

export type PessoaContrato = {
  nome: string | null;
  cargo: string | null;
  cpf: string | null;
  rg: string | null;
  orgao_emissor_rg: string | null;
  nacionalidade: string | null;
  estado_civil: string | null;
  profissao: string | null;
  endereco: string | null;
};

export type ParteContrato = {
  papel: 'CONTRATANTE' | 'CONTRATADO';
  nome: string | null;
  documento: string | null;
  tipo_documento: 'CNPJ' | 'CPF' | null;
  endereco: string | null;
  representante: PessoaContrato | null;
};

export type SignatarioContrato = {
  papel: 'CONTRATANTE' | 'CONTRATADO' | 'TESTEMUNHA';
  nome: string | null;
  cargo: string | null;
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  orgao_emissor_rg: string | null;
  nacionalidade: string | null;
  estado_civil: string | null;
  profissao: string | null;
  endereco: string | null;
  /** true quando o nome foi confirmado no bloco de assinatura do PDF. */
  confirmado_no_bloco_de_assinatura: boolean;
  /** false quando o dado existe no documento mas o OCR não conseguiu lê-lo (ex.: manuscrito). */
  legivel: boolean;
};

export type ItemContrato = {
  codigo: number;
  descricao: string;
  unidade: string;
  unidade_original: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  /** Correções aplicadas por reconciliação (vazio quando o item foi lido sem ajustes). */
  correcoes: string[];
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
  signatarios: SignatarioContrato[];
  assinatura: {
    local: string | null;
    data: string | null;
    assinatura_digital: {
      detectada: boolean;
      plataforma: string | null;
      assinante: string | null;
    };
  };
  vigencia: {
    data_inicio: string | null;
    data_fim: string | null;
    /** true quando data_fim foi calculada a partir de uma duração (ex.: "12 meses"), não lida do texto. */
    data_fim_calculada: boolean;
    trecho: string | null;
  };
  valor_total: number | null;
  itens: ItemContrato[];
  dotacoes: DotacaoContrato[];
  condicoes: {
    prazo_execucao: { quantidade: number; unidade: string; marco: string | null } | null;
    prazo_pagamento: { quantidade: number; unidade: string } | null;
    reajuste: { prazo: string | null; indice: string | null } | null;
  };
  fundamentacao_legal: string[];
  foro: string | null;
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

  const hasTitle =
    /TERMO\s+DE\s+CONTRATO/i.test(head) || new RegExp(String.raw`CONTRATO\s+${NUM}\d`, 'i').test(head);
  const hasParties =
    new RegExp(MARK_CONTRATANTE, 'i').test(flat) && new RegExp(MARK_CONTRATADO, 'i').test(flat);
  const clauseCount = (flat.match(/CL[ÁA]USULA\s+/gi) ?? []).length;

  return (hasTitle || hasParties) && clauseCount >= 3;
};

// ---------------------------------------------------------------- partes e pessoas

const CARGO_PATTERN =
  /^(Vice-Prefeit[oa]|Prefeit[oa]|Secret[áa]ri[oa](?:\s+Municipal)?|Presidente|Diretor(?:a)?|Gestor(?:a)?|S[óo]ci[oa](?:-Administrador(?:a)?)?|Administrador(?:a)?|Procurador(?:a)?|Representante\s+Legal|Propriet[áa]ri[oa]|Titular)\s+(.+)$/i;

const ESTADO_CIVIL = /^(casad[oa]|solteir[oa]|divorciad[oa]|vi[úu]v[oa]|separad[oa]|uni[ãa]o\s+est[áa]vel)$/i;
const NACIONALIDADE = /^(brasileir[oa]|estrangeir[oa]|portugu[êe]s(?:a)?|naturalizad[oa])$/i;
const NAO_PROFISSAO = /^(residente|domiciliad|portador|inscrit|CPF|CNPJ|Carteira|RG\b|C\.?I\.?\b)/i;

const parsePessoa = (value: string): PessoaContrato => {
  const text = clean(value) ?? '';

  const cpf = findCpf(text);
  const rgMatch = text.match(
    new RegExp(
      String.raw`(?:Carteira\s+de\s+Identidade|\bRG\b)${LABEL_GAP}([A-Z]{2}-[\d.]+|\d[\d.\-A-Za-z]*)(?:\s+([A-Z]{2,6}\s*\/\s*[A-Z]{2}))?`,
      'i',
    ),
  );
  const enderecoMatch = text.match(
    /residente\s+e\s+domiciliad[oa]\s+(?:na|no|em)\s+(.+?)(?=,\s*(?:CPF|CNPJ|Carteira|portador|inscrit|RG\b)|$)/i,
  );

  // Parte inicial: "<cargo> <nome>, <nacionalidade>, <estado civil>, <profissão>, residente..."
  const beforeResidence = text.split(/,\s*residente\b/i)[0];
  const tokens = beforeResidence.split(',').map((token) => token.trim()).filter(Boolean);

  let cargo: string | null = null;
  let nome: string | null = null;
  const first = tokens[0] ?? '';
  const cargoMatch = first.match(CARGO_PATTERN);

  if (cargoMatch) {
    cargo = clean(cargoMatch[1]);
    nome = clean(cargoMatch[2]);
  } else {
    nome = clean(first.replace(/^(?:o\s+|a\s+)?(?:Sr\.?|Sra\.?|Senhor(?:a)?)\s+/i, ''));
  }

  // Um "nome" que contém dígitos ou rótulos de documento não é um nome.
  if (nome && (/\d/.test(nome) || /^(CPF|CNPJ|Carteira)\b/i.test(nome))) nome = null;

  let nacionalidade: string | null = null;
  let estadoCivil: string | null = null;
  let profissao: string | null = null;

  for (const token of tokens.slice(1)) {
    if (!nacionalidade && NACIONALIDADE.test(token)) nacionalidade = token;
    else if (!estadoCivil && ESTADO_CIVIL.test(token)) estadoCivil = token;
    else if (!profissao && !NAO_PROFISSAO.test(token) && /^[\p{L} ./-]+$/u.test(token)) profissao = token;
  }

  return {
    nome,
    cargo,
    cpf,
    rg: rgMatch ? clean(rgMatch[1]) : null,
    orgao_emissor_rg: rgMatch?.[2] ? clean(rgMatch[2].replace(/\s+/g, '')) : null,
    nacionalidade,
    estado_civil: estadoCivil,
    profissao,
    endereco: clean(enderecoMatch?.[1]),
  };
};

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
  const empty: ParteContrato = {
    papel,
    nome: null,
    documento: null,
    tipo_documento: null,
    endereco: null,
    representante: null,
  };
  if (!clause) return empty;

  const [head, representanteText] = clause.split(
    /,?\s*neste\s+ato\s+representad[oa]s?\s+(?:pel[oa]s?|por)\s+/i,
  );

  const cnpj = findCnpj(head);
  const cpf = cnpj ? null : findCpf(head);
  const withoutDocument = head
    .replace(/,?\s*(?:inscrit[oa]\s+(?:no|sob)\s+(?:o\s+)?)?(?:CNPJ|CPF)\b.*$/i, '')
    .replace(/,?\s*com\s+sede\s+(?:na|no|em)\b.*$/i, '')
    .replace(/^\s*(?:a|o)\s+(?:empresa|pessoa\s+jur[íi]dica|munic[íi]pio\s+de)\s+(?=\S)/i, (m) =>
      /munic/i.test(m) ? 'Município de ' : '',
    )
    .replace(/^\s*(?:de\s+(?:um|outro)\s+lado|do\s+outro\s+lado|e)\s+/i, '');
  const { nome, endereco } = splitNomeEndereco(withoutDocument);

  return {
    papel,
    nome: nome ? fixOcrDigitsInWords(nome) : null,
    documento: cnpj ?? cpf,
    tipo_documento: cnpj ? 'CNPJ' : cpf ? 'CPF' : null,
    endereco: endereco ? fixOcrDigitsInWords(endereco) : null,
    representante: representanteText ? parsePessoa(representanteText) : null,
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

  if (papel === 'CONTRATADO' && !filled.documento) {
    const all = [...flat.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)].map((m) => m[1]);
    const other = all.find((cnpj) => cnpj !== contratante?.documento);
    if (other) {
      filled.documento = other;
      filled.tipo_documento = 'CNPJ';
    }
  }

  // Nome do contratado igual ao da prefeitura é sinal de captura errada.
  if (papel === 'CONTRATADO' && contratante?.nome && normName(filled.nome) === normName(contratante.nome)) {
    filled.nome = title.contratado ? fixOcrDigitsInWords(title.contratado) : null;
  }

  return filled;
};

// ---------------------------------------------------------------- contratante fixo

/**
 * O contratante é sempre a própria prefeitura. Quando configurado (env), o valor configurado
 * vence o que o OCR leu — evita "MAR1ZOPOLIS" e afins. O representante (prefeito) continua
 * vindo do texto.
 */
const applyContratanteFixo = (parte: ParteContrato): ParteContrato => {
  const nome = process.env.CONTRATANTE_NOME?.trim() || DEFAULT_CONTRATANTE.nome;
  const cnpjRaw = process.env.CONTRATANTE_CNPJ?.trim() || DEFAULT_CONTRATANTE.cnpj;
  const endereco = process.env.CONTRATANTE_ENDERECO?.trim() || DEFAULT_CONTRATANTE.endereco;
  const digits = cnpjRaw.replace(/\D/g, '');

  return {
    ...parte,
    nome: nome || parte.nome,
    documento: digits.length === 14 ? maskCnpj(digits) : parte.documento,
    tipo_documento: digits.length === 14 ? 'CNPJ' : parte.tipo_documento,
    endereco: parte.endereco ?? (endereco || null),
  };
};

const DEFAULT_CONTRATANTE = {
  nome: 'Prefeitura Municipal de Marizópolis',
  cnpj: '01.612.941/0001-49',
  endereco: '',
};

// ---------------------------------------------------------------- identificação

const extractNumeroContrato = (text: string): string | null => {
  const pattern = new RegExp(String.raw`CONTRATO\s+${NUM}(\d[\w./-]*)`, 'i');
  const raw = text.slice(0, HEAD_SIZE).match(pattern)?.[1] ?? text.match(pattern)?.[1];
  // "CONTRATO Nº 045/2026." no fim de frase — o ponto final não faz parte do número.
  return clean(raw?.replace(/[.,;:]+$/, '')) ?? null;
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
    String.raw`^\s*(DISPENSA|INEXIGIBILIDADE|PREG[ÃA]O(?:\s+(?:ELETR[ÔO]NICO|PRESENCIAL))?|CONCORR[ÊE]NCIA|TOMADA\s+DE\s+PRE[ÇC]OS|CONVITE|ADES[ÃA]O)(?:\s+DE\s+LICITA[ÇC][ÃA]O)?\s+${NUM}([\w./-]+)`,
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
    UN: 'Un', UND: 'Un', UNID: 'Un', UNIDADE: 'Un', CX: 'Cx', CAIXA: 'Cx', KG: 'Kg',
    L: 'L', LT: 'L', LTS: 'L', M: 'm', ML: 'm', PCT: 'Pct', PC: 'Pct', PAR: 'Par',
    SACO: 'Saco', SC: 'Saco', RESMA: 'Resma',
  };
  return { valor: known[compact] ?? raw.trim(), suspeito: false };
};

type RawRow = {
  codigo: number;
  descLines: string[];
  tail: { unidade: string; quantidade: string; unitario: string; total: string } | null;
};

const locateItemRows = (lines: string[]): { rows: RawRow[]; totalTabela: number | null } => {
  const start = lines.findIndex((line) => /C[ÓO]DIGO/i.test(line) && /DISCRIMINA/i.test(line));
  if (start === -1) return { rows: [], totalTabela: null };

  const rows: RawRow[] = [];
  let current: RawRow | null = null;
  let expected = 1;
  let totalTabela: number | null = null;

  for (const line of lines.slice(start + 1)) {
    const totalMatch = line.match(/^Total\s*:\s*(.+)$/i);
    if (totalMatch) {
      totalTabela = parseBrazilianNumber(totalMatch[1].trim());
      break;
    }

    let content = line;
    const startMatch = line.match(/^(\d{1,3})(?:\s+(.*))?$/);

    // Nova linha: começa com o próximo código esperado. Se a linha anterior ainda não tem cauda
    // (ilegível), só aceita quando há texto depois do código — assim um item ilegível não "engole"
    // o seguinte, e um "2" solto no meio de uma descrição não quebra a linha.
    const startsRow =
      startMatch !== null &&
      Number(startMatch[1]) === expected &&
      (!current || current.tail !== null || Boolean(startMatch[2]?.trim()));

    if (startMatch && startsRow) {
      current = { codigo: expected, descLines: [], tail: null };
      rows.push(current);
      expected += 1;
      content = startMatch[2] ?? '';
    }

    if (!current || !content.trim()) continue;

    const tailMatch = content.match(ITEM_TAIL);
    if (tailMatch && !current.tail) {
      if (tailMatch[1]?.trim()) current.descLines.push(tailMatch[1].trim());
      current.tail = {
        unidade: tailMatch[2],
        quantidade: tailMatch[3],
        unitario: tailMatch[4],
        total: tailMatch[5],
      };
    } else if (!current.tail) {
      current.descLines.push(content.trim());
    }
  }

  return { rows, totalTabela };
};

/**
 * Quando o OCR lê uma palavra solta (com `/` ou similar colado) ANTES de um parágrafo de várias
 * linhas, ela é, na prática, a primeira palavra da 2ª linha visual da célula
 * ("/GALVANIZADA" + "…METÁLICA" + "COM INSTALAÇÃO…" => "…METÁLICA GALVANIZADA COM INSTALAÇÃO…").
 */
const buildDescricao = (descLines: string[], correcoes: string[]): string => {
  const lines = [...descLines];
  const first = lines[0] ?? '';

  if (lines.length >= 3 && /^[^\p{L}\p{N}]+[\p{L}]+$/u.test(first)) {
    const displaced = first.replace(/^[^\p{L}\p{N}]+/u, '');
    lines.splice(0, 1);
    lines.splice(1, 0, displaced);
    correcoes.push('descricao_reordenada_por_ocr');
  }

  return clean(lines.join(' ').replace(/^[^\p{L}\p{N}]+/u, '')) ?? '';
};

const reconcileItems = (
  rows: RawRow[],
): { itens: ItemContrato[]; avisos: string[] } => {
  const itens: ItemContrato[] = [];
  const avisos: string[] = [];

  for (const row of rows) {
    if (!row.tail) {
      avisos.push(`Item ${row.codigo}: não foi possível ler quantidade e valores; preencha manualmente.`);
      continue;
    }

    const correcoes: string[] = [];
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
          correcoes.push(`valor_unitario_corrigido_de_${row.tail.unitario}_para_${derived.toFixed(2)}`);
          unitario = derived;
        } else {
          total = Math.round(quantidade * unitario * 100) / 100;
          correcoes.push(`valor_total_recalculado_de_${row.tail.total}`);
        }
      }
    } else if (unitario !== null && total === null) {
      total = Math.round(quantidade * unitario * 100) / 100;
      correcoes.push(`valor_total_recalculado_de_${row.tail.total}`);
    } else if (unitario === null && total !== null) {
      unitario = Math.round((total / quantidade) * 100) / 100;
      correcoes.push(`valor_unitario_recalculado_de_${row.tail.unitario}`);
    } else {
      avisos.push(`Item ${row.codigo}: valores ilegíveis; preencha manualmente.`);
      continue;
    }

    const descricao = buildDescricao(row.descLines, correcoes);
    const { valor: unidade, suspeito } = normalizeUnidade(row.tail.unidade);

    if (suspeito) correcoes.push(`unidade_corrigida_de_${row.tail.unidade}_para_${unidade}`);

    itens.push({
      codigo: row.codigo,
      descricao,
      unidade,
      unidade_original: row.tail.unidade,
      quantidade,
      valor_unitario: unitario as number,
      valor_total: total as number,
      correcoes,
    });
  }

  return { itens, avisos };
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

const extractAssinatura = (text: string, flat: string) => {
  const local = flat.match(
    /([A-ZÀ-Ý][\p{L}]+(?:\s+[\p{L}]+){0,3})\s*-\s*([A-Z]{2})\s*,\s*(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})/u,
  );

  let data: string | null = null;
  if (local) {
    const month = monthNumber(local[4]);
    if (month) data = toIso(Number(local[3]), month, Number(local[5]));
  }

  const digital = /Documento\s+assinado\s+digitalmente\s+(.+?)\s+Data\b/i.exec(flat);
  const plataforma = /iti\.gov\.br/i.test(text) || /gov\.?br/i.test(flat) ? 'gov.br' : null;

  return {
    local: local ? `${local[1]} - ${local[2]}` : null,
    data,
    assinatura_digital: {
      detectada: Boolean(digital),
      plataforma: digital ? plataforma : null,
      assinante: digital ? clean(fixOcrDigitsInWords(digital[1])) : null,
    },
  };
};

const NAME_NOISE = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);

/** Todos os termos relevantes do nome aparecem no bloco de assinatura? */
const blockHasName = (block: string, nome: string | null): boolean => {
  if (!nome) return false;
  const haystack = stripAccents(block).toUpperCase();
  const tokens = stripAccents(nome)
    .toUpperCase()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !NAME_NOISE.has(token));
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
};

const emptySignatario = (papel: SignatarioContrato['papel']): SignatarioContrato => ({
  papel,
  nome: null,
  cargo: null,
  cpf: null,
  cnpj: null,
  rg: null,
  orgao_emissor_rg: null,
  nacionalidade: null,
  estado_civil: null,
  profissao: null,
  endereco: null,
  confirmado_no_bloco_de_assinatura: false,
  legivel: true,
});

const TESTEMUNHAS_POR_EXTENSO: Record<string, number> = { uma: 1, duas: 2, duos: 2, dois: 2, tres: 3, três: 3 };

const buildSignatarios = (
  text: string,
  contratante: ParteContrato,
  contratado: ParteContrato,
  assinaturaDigital: { assinante: string | null },
  avisos: string[],
): SignatarioContrato[] => {
  const signatarios: SignatarioContrato[] = [];

  const idxTestemunhas = text.search(/^\s*TESTEMUNHAS\s*:?\s*$/im);
  const idxContratante = text.search(/PELO\s+\S{0,6}\s*\S{0,6}\s*TRATANTE|PELO\s+CONTRATANTE/i);
  const idxContratado = text.search(/PELO\s+CONTRATAD[OA]/i);
  const blockContratante =
    idxContratante !== -1 ? text.slice(idxContratante, idxContratado > idxContratante ? idxContratado : undefined) : '';
  const blockContratado = idxContratado !== -1 ? text.slice(idxContratado) : '';
  const blockTestemunhas =
    idxTestemunhas !== -1
      ? text.slice(idxTestemunhas, idxContratante > idxTestemunhas ? idxContratante : undefined)
      : '';

  // --- Contratante: dados completos vêm da qualificação (bloco de assinatura costuma sair ilegível).
  const rep = contratante.representante;
  const contratanteSig = emptySignatario('CONTRATANTE');
  if (rep) {
    Object.assign(contratanteSig, {
      nome: rep.nome,
      cargo: rep.cargo,
      cpf: rep.cpf,
      rg: rep.rg,
      orgao_emissor_rg: rep.orgao_emissor_rg,
      nacionalidade: rep.nacionalidade,
      estado_civil: rep.estado_civil,
      profissao: rep.profissao,
      endereco: rep.endereco,
    });
  }
  contratanteSig.confirmado_no_bloco_de_assinatura = blockHasName(blockContratante, contratanteSig.nome);
  if (rep && !contratanteSig.confirmado_no_bloco_de_assinatura) {
    avisos.push(
      'Bloco de assinatura do contratante ilegível no OCR: os dados do signatário foram tirados da qualificação das partes. Confira a assinatura no PDF.',
    );
  }
  if (rep || contratante.nome) signatarios.push(contratanteSig);

  // --- Contratado: se não há representante, o titular da empresa é quem assina.
  const contratadoSig = emptySignatario('CONTRATADO');
  const repContratado = contratado.representante;
  contratadoSig.nome = repContratado?.nome ?? contratado.nome;
  contratadoSig.cargo = repContratado?.cargo ?? null;
  contratadoSig.cpf = repContratado?.cpf ?? (contratado.tipo_documento === 'CPF' ? contratado.documento : null);
  contratadoSig.cnpj = contratado.tipo_documento === 'CNPJ' ? contratado.documento : null;
  contratadoSig.rg = repContratado?.rg ?? null;
  contratadoSig.orgao_emissor_rg = repContratado?.orgao_emissor_rg ?? null;
  contratadoSig.endereco = repContratado?.endereco ?? contratado.endereco;
  contratadoSig.confirmado_no_bloco_de_assinatura =
    blockHasName(blockContratado, contratadoSig.nome) ||
    blockHasName(assinaturaDigital.assinante ?? '', contratadoSig.nome);
  if (contratadoSig.nome || contratadoSig.cnpj) signatarios.push(contratadoSig);

  // --- Testemunhas: costumam ser manuscritas, então só aceitamos CPF estrito.
  const flatBlock = flatten(text);
  const countMatch = flatBlock.match(/por\s+(\p{L}+|\d+)\s+testemunhas/iu);
  const countRaw = countMatch?.[1]?.toLowerCase() ?? '';
  const expected = /^\d+$/.test(countRaw) ? Number(countRaw) : TESTEMUNHAS_POR_EXTENSO[countRaw] ?? 0;

  const cpfsTestemunhas = [
    ...new Set(blockTestemunhas.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g) ?? []),
  ];

  cpfsTestemunhas.forEach((cpf) => {
    const witness = emptySignatario('TESTEMUNHA');
    witness.cpf = cpf;
    signatarios.push(witness);
  });

  const missing = Math.max(expected - cpfsTestemunhas.length, 0);
  for (let i = 0; i < missing; i += 1) {
    const witness = emptySignatario('TESTEMUNHA');
    witness.legivel = false;
    signatarios.push(witness);
  }
  if (missing > 0) {
    avisos.push(
      `${missing} testemunha(s) não puderam ser lidas (assinatura/identificação manuscrita): preencha manualmente.`,
    );
  }

  return signatarios;
};

// ---------------------------------------------------------------- condições

const extractFundamentacao = (flat: string): string[] => {
  const clause = sliceBetween(flat, /CL[ÁA]USULA\s+PRIMEIRA\s*-\s*DOS\s+FUNDAMENTOS\s*:/i, /CL[ÁA]USULA\s+SEGUNDA/i);
  if (!clause) return [];

  const laws: string[] = [];
  const pattern = new RegExp(String.raw`Lei\s+(Federal|Complementar)?\s*${NUM}(\d{1,3}(?:\.\d{3})?)`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(clause)) !== null) {
    const yearMatch = clause.slice(match.index + match[0].length, match.index + match[0].length + 60).match(/(\d{4})/);
    const kind = match[1] ? `Lei ${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}` : 'Lei';
    const label = `${kind} nº ${match[2]}${yearMatch ? `/${yearMatch[1]}` : ''}`;
    if (!laws.includes(label)) laws.push(label);
  }

  return laws;
};

const PRAZO_VIGENCIA_HEADING = /CL[ÁA]USULA\s+[\p{L}ÁÉÍÓÚÂÊÔÃÕÇ ]+?\s*-\s*DO\s+PRAZO\s+E\s+DA\s+VIG[ÊE]NCIA\s*:/iu;
const NEXT_CLAUSE = /CL[ÁA]USULA\s+/i;

/** A cláusula de prazo/vigência; evita capturar "vigência" citada na cláusula de reajuste. */
const prazoVigenciaClause = (flat: string): string =>
  sliceBetween(flat, PRAZO_VIGENCIA_HEADING, NEXT_CLAUSE) ?? flat;

const extractVigencia = (
  rawFlat: string,
  dataAssinatura: string | null,
): ContratoExtraction['vigencia'] => {
  const flat = prazoVigenciaClause(rawFlat);
  const trechoMatch = flat.match(/vig[êe]ncia[^;]{0,200}/i);
  const trecho = clean(trechoMatch?.[0]);

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

  return { data_inicio: dataInicio, data_fim: dataFim, data_fim_calculada: calculada, trecho };
};

const extractCondicoes = (flat: string): ContratoExtraction['condicoes'] => {
  const prazos = prazoVigenciaClause(flat);
  const execucao = prazos.match(
    /prazos?\s+para\s+(?:produ\S*|entrega|execu\S*)[^.]{0,100}?at[ée]\s+(\d{1,3})\s+(dias\s+[úu]teis|dias\s+corridos|dias|meses)/i,
  );
  const marco = prazos.match(
    /(?:expedi[çc][ãa]o|emiss[ãa]o|recebimento)\s+d[ao]s?\s+(Ordem\s+de\s+(?:Fornecimento|Servi[çc]o)|Nota\s+de\s+Empenho)/i,
  );
  const pagamento = flat.match(
    /prazo\s+para\s+pagamento\s+ser[áa]\s+de\s+at[ée]\s+(\d{1,3})\s*(?:\([^)]*\)\s*)?(dias\s+corridos|dias\s+[úu]teis|dias)/i,
  );
  const reajustePrazo = flat.match(/irreajust[áa]veis\s+no\s+prazo\s+de\s+([^.]{2,40})/i);
  const indice = flat.match(/\b(IPCA|INPC|IGP-?M|INCC|IPC-?FIPE)\b/i);

  return {
    prazo_execucao: execucao
      ? { quantidade: Number(execucao[1]), unidade: execucao[2].toLowerCase(), marco: clean(marco?.[1]) }
      : null,
    prazo_pagamento: pagamento ? { quantidade: Number(pagamento[1]), unidade: pagamento[2].toLowerCase() } : null,
    reajuste:
      reajustePrazo || indice
        ? { prazo: clean(reajustePrazo?.[1]), indice: indice ? indice[1].toUpperCase() : null }
        : null,
  };
};

const extractValorTotal = (flat: string): number | null => {
  const match = flat.match(/valor\s+total\s+(?:deste|do)\s+contrato[^\d]{0,60}?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
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

  const contratante = applyContratanteFixo(
    fillParteFallbacks(parseParte('CONTRATANTE', contratanteClause), flat, 'CONTRATANTE'),
  );
  const contratado = fillParteFallbacks(parseParte('CONTRATADO', contratadoClause), flat, 'CONTRATADO', contratante);

  // Identificação
  const { modalidade, numero: numeroModalidade } = extractModalidade(text);
  const numeroContrato = extractNumeroContrato(text);
  const numeroProcesso = extractNumeroProcesso(text);

  // Assinatura e vigência
  const assinatura = extractAssinatura(text, flat);
  const vigencia = extractVigencia(flat, assinatura.data);

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

  const corrigidos = reconciled.itens.filter((item) => item.correcoes.length > 0);
  if (corrigidos.length > 0) {
    avisos.push(
      `${corrigidos.length} item(ns) tiveram valor, unidade ou descrição ajustados por conflito de OCR (ver 'correcoes'): confira com o PDF.`,
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
  if (vigencia.data_fim_calculada) {
    avisos.push('A data final da vigência foi calculada a partir do prazo informado no contrato: confira.');
  }

  const signatarios = buildSignatarios(text, contratante, contratado, assinatura.assinatura_digital, avisos);

  const foro = flat.match(/Foro\s+da\s+Comarca\s+de\s+([A-ZÀ-Ý][\p{L} ]*?)(?=\s*[.,;]|\s+E,)/u)?.[1];

  return {
    numero_contrato: numeroContrato,
    numero_processo: numeroProcesso,
    modalidade,
    numero_modalidade: numeroModalidade,
    objeto,
    contratante,
    contratado,
    signatarios,
    assinatura,
    vigencia,
    valor_total: valorTotal,
    itens: reconciled.itens,
    dotacoes: extractDotacoes(lines),
    condicoes: extractCondicoes(flat),
    fundamentacao_legal: extractFundamentacao(flat),
    foro: clean(foro),
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
