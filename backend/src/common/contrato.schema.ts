import { z } from "zod";

/**
 * Schema canônico do contrato — espelha `ContratoExtraction` do pacote `parsing`
 * (`parsing/src/services/contratoService.ts`), que é a especificação real do domínio.
 *
 * Regra do projeto: nenhum campo aqui pode ser inventado. Se o extrator não produz,
 * não existe. Os únicos campos operacionais fora da extração são `id`, `status`,
 * `arquivoPdf` e os saldos de item (`recebido`/`consumido`), que vivem no banco.
 *
 * Escopo do contrato extraído: identificação, objeto/valor/vigência, partes
 * (nome + documento), itens, dotações, avisos e validações. Bloco de assinatura,
 * signatários, condições, fundamentação e foro ficaram fora — a data da assinatura
 * é lida internamente no parsing apenas como fallback da vigência.
 *
 * O arquivo `contrato.schema.test.ts` parseia o golden file do contrato real
 * (`parsing/src/services/__fixtures__/contrato_dv00014_2026.extracted.json`). Se o
 * extrator mudar de forma incompatível, o teste do backend quebra — é o contrato
 * entre os pacotes enquanto não há workspace npm.
 */

const texto = z.string().nullable();
const numero = z.number().nullable();

export const PAPEIS_PARTE = ["CONTRATANTE", "CONTRATADO"] as const;

export const ParteContratoSchema = z.object({
  papel: z.enum(PAPEIS_PARTE),
  nome: texto,
  documento: texto,
});

export const ItemContratoSchema = z.object({
  codigo: z.number().int().nonnegative(),
  descricao: z.string(),
  unidade: z.string(),
  unidade_original: z.string(),
  // m²/kg são fracionários — nunca arredondar para Int.
  quantidade: z.number().nonnegative(),
  valor_unitario: z.number().nonnegative(),
  valor_total: z.number().nonnegative(),
});

export const DotacaoContratoSchema = z.object({
  unidade_codigo: z.string(),
  unidade: z.string(),
  funcional_programatica: texto,
  acao: texto,
  ficha: texto,
  elemento_codigo: texto,
  elemento_descricao: texto,
  natureza_codigo: texto,
  natureza: texto,
  complemento: texto,
});

/** Payload devolvido por `POST /upload` do parsing em `structured_data.contrato`. */
export const ContratoExtractionSchema = z.object({
  numero_contrato: texto,
  numero_processo: texto,
  modalidade: texto,
  numero_modalidade: texto,
  objeto: texto,
  contratante: ParteContratoSchema,
  contratado: ParteContratoSchema,
  vigencia: z.object({
    data_inicio: texto,
    data_fim: texto,
  }),
  valor_total: numero,
  itens: z.array(ItemContratoSchema),
  dotacoes: z.array(DotacaoContratoSchema),
  validacoes: z.object({
    soma_itens_confere_total_da_tabela: z.boolean().nullable(),
    soma_itens_confere_valor_do_contrato: z.boolean().nullable(),
  }),
  avisos: z.array(z.string()),
});

export type ContratoExtraction = z.infer<typeof ContratoExtractionSchema>;

export type ContratoExtractionInput = z.infer<typeof ContratoExtractionSchema>;

/**
 * Vínculo contrato ↔ secretaria beneficiária. Sai das dotações (`dotacoes[].unidade`);
 * `origem` registra se veio da extração ou foi ajustado à mão na revisão.
 */
export const ORIGENS_VINCULO = ["DOTACAO", "MANUAL"] as const;

export const ContratoSetorInputSchema = z.object({
  idSetor: z.number().int().positive("Setor inválido"),
  origem: z.enum(ORIGENS_VINCULO).default("MANUAL"),
});

export type ContratoSetorInput = z.infer<typeof ContratoSetorInputSchema>;

// ---------- Revisão manual do contrato importado ----------
//
// O payload da revisão espelha o `GET /api/contratos/:id` (camelCase, nomes do
// model Prisma), não o formato da extração. É a mesma forma que a barra lateral
// de revisão já recebe na tela — evita conversão de snake_case no browser.

const textoRevisao = z.string().nullable().optional();

const dataRevisao = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/,
    "Data inválida (use AAAA-MM-DD)",
  )
  .nullable()
  .optional();

export const ParteContratoRevisaoSchema = z.object({
  papel: z.enum(PAPEIS_PARTE),
  nome: textoRevisao,
  documento: textoRevisao,
});

export const ItemContratoRevisaoSchema = z.object({
  /** Presente quando o item já existe; itens sem `id` são criados. */
  id: z.number().int().positive().optional(),
  codigo: z.number().int().nonnegative().nullable().optional(),
  descricao: z.string().trim().min(1, "Descrição obrigatória"),
  unidade: z.string().trim().min(1, "Unidade obrigatória"),
  unidadeOriginal: z.string().nullable().optional(),
  quantidade: z.number().nonnegative(),
  valorUnitario: z.number().nonnegative(),
  /** Quando omitido, o backend calcula `quantidade * valorUnitario`. */
  valorTotal: z.number().nonnegative().optional(),
});

export const DotacaoContratoRevisaoSchema = z.object({
  id: z.number().int().positive().optional(),
  unidadeCodigo: z.string().trim().min(1, "Informe o código da unidade"),
  unidade: z.string().trim().min(1, "Informe a unidade"),
  funcionalProgramatica: textoRevisao,
  acao: textoRevisao,
  ficha: textoRevisao,
  elementoCodigo: textoRevisao,
  elementoDescricao: textoRevisao,
  naturezaCodigo: textoRevisao,
  natureza: textoRevisao,
  complemento: textoRevisao,
});

/**
 * Revisão do contrato importado. Tudo é opcional: a tela de revisão envia o que o
 * usuário viu/corrigiu. `confirmar: true` promove o contrato de RASCUNHO para ATIVA.
 *
 * Regras aplicadas no repository:
 * - só contratos `RASCUNHO` aceitam revisão (409 caso contrário);
 * - `confirmar` exige todos os campos essenciais preenchidos e a soma dos itens
 *   conferindo com o valor total (409/400 caso contrário);
 * - `numero` duplicado responde 409 (`DUPLICATE_CONTRATO`);
 * - `avisos` e `dadosExtraidos` são histórico e nunca são apagados pela revisão.
 */
export const AtualizarContratoSchema = z.object({
  numero: z.string().trim().min(1).optional(),
  numeroProcesso: textoRevisao,
  modalidade: textoRevisao,
  numeroModalidade: textoRevisao,
  objeto: textoRevisao,
  valorTotal: z.number().nonnegative().nullable().optional(),
  vigenciaInicio: dataRevisao,
  vigenciaFim: dataRevisao,
  partes: z.array(ParteContratoRevisaoSchema).optional(),
  itens: z.array(ItemContratoRevisaoSchema).optional(),
  dotacoes: z.array(DotacaoContratoRevisaoSchema).optional(),
  setores: z.array(ContratoSetorInputSchema).optional(),
  /** Promove RASCUNHO → ATIVA depois da revisão. */
  confirmar: z.boolean().optional(),
});

export type AtualizarContratoInput = z.infer<typeof AtualizarContratoSchema>;
export type ParteContratoRevisao = z.infer<typeof ParteContratoRevisaoSchema>;
export type ItemContratoRevisao = z.infer<typeof ItemContratoRevisaoSchema>;
export type DotacaoContratoRevisao = z.infer<typeof DotacaoContratoRevisaoSchema>;
