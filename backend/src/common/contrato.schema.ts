import { z } from "zod";

/**
 * Schema canônico do contrato — espelha `ContratoExtraction` do pacote `parsing`
 * (`parsing/src/services/contratoService.ts`), que é a especificação real do domínio.
 *
 * Regra do projeto: nenhum campo aqui pode ser inventado. Se o extrator não produz,
 * não existe. Os únicos campos operacionais fora da extração são `id`, `status`,
 * `arquivoPdf` e os saldos de item (`recebido`/`consumido`), que vivem no banco.
 *
 * O arquivo `contrato.schema.test.ts` parseia o golden file do contrato real
 * (`parsing/src/services/__fixtures__/contrato_dv00014_2026.extracted.json`). Se o
 * extrator mudar de forma incompatível, o teste do backend quebra — é o contrato
 * entre os pacotes enquanto não há workspace npm.
 */

const texto = z.string().nullable();
const numero = z.number().nullable();

export const PAPEIS_PARTE = ["CONTRATANTE", "CONTRATADO"] as const;
export const PAPEIS_SIGNATARIO = ["CONTRATANTE", "CONTRATADO", "TESTEMUNHA"] as const;

export const TipoDocumentoParteSchema = z.enum(["CNPJ", "CPF"]).nullable();

/** Qualificação de uma pessoa física (representante legal ou signatário). */
export const PessoaContratoSchema = z.object({
  nome: texto,
  cargo: texto,
  cpf: texto,
  rg: texto,
  orgao_emissor_rg: texto,
  nacionalidade: texto,
  estado_civil: texto,
  profissao: texto,
  endereco: texto,
});

export const ParteContratoSchema = z.object({
  papel: z.enum(PAPEIS_PARTE),
  nome: texto,
  documento: texto,
  tipo_documento: TipoDocumentoParteSchema,
  endereco: texto,
  representante: PessoaContratoSchema.nullable(),
});

export const SignatarioContratoSchema = PessoaContratoSchema.extend({
  papel: z.enum(PAPEIS_SIGNATARIO),
  cnpj: texto,
  /** O nome foi confirmado no bloco de assinatura do PDF (não só na qualificação das partes). */
  confirmado_no_bloco_de_assinatura: z.boolean(),
  /** `false` quando o dado existe no documento mas o OCR não conseguiu lê-lo. */
  legivel: z.boolean(),
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
  correcoes: z.array(z.string()),
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

export const CondicoesContratoSchema = z.object({
  prazo_execucao: z
    .object({
      quantidade: z.number().nonnegative(),
      unidade: z.string(),
      marco: texto,
    })
    .nullable(),
  prazo_pagamento: z
    .object({
      quantidade: z.number().nonnegative(),
      unidade: z.string(),
    })
    .nullable(),
  reajuste: z
    .object({
      prazo: texto,
      indice: texto,
    })
    .nullable(),
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
  signatarios: z.array(SignatarioContratoSchema),
  assinatura: z.object({
    local: texto,
    data: texto, // ISO (yyyy-mm-dd)
    assinatura_digital: z.object({
      detectada: z.boolean(),
      plataforma: texto,
      assinante: texto,
    }),
  }),
  vigencia: z.object({
    data_inicio: texto,
    data_fim: texto,
    data_fim_calculada: z.boolean(),
    trecho: texto,
  }),
  valor_total: numero,
  itens: z.array(ItemContratoSchema),
  dotacoes: z.array(DotacaoContratoSchema),
  condicoes: CondicoesContratoSchema,
  fundamentacao_legal: z.array(z.string()),
  foro: texto,
  validacoes: z.object({
    soma_itens_confere_total_da_tabela: z.boolean().nullable(),
    soma_itens_confere_valor_do_contrato: z.boolean().nullable(),
  }),
  avisos: z.array(z.string()),
});

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

/**
 * Revisão do contrato importado. Tudo é opcional: a tela de revisão envia só o que o
 * usuário corrigiu. `confirmar: true` promove o contrato de RASCUNHO para ATIVA.
 */
export const AtualizarContratoSchema = z.object({
  numero_contrato: z.string().trim().min(1).nullable().optional(),
  numero_processo: texto.optional(),
  modalidade: texto.optional(),
  numero_modalidade: texto.optional(),
  objeto: z.string().trim().min(1).nullable().optional(),
  contratante: ParteContratoSchema.optional(),
  contratado: ParteContratoSchema.optional(),
  signatarios: z.array(SignatarioContratoSchema).optional(),
  assinatura: ContratoExtractionSchema.shape.assinatura.optional(),
  vigencia: z
    .object({
      data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable(),
      data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable(),
      data_fim_calculada: z.boolean().optional(),
      trecho: texto.optional(),
    })
    .optional(),
  valor_total: z.number().nonnegative().nullable().optional(),
  itens: z.array(ItemContratoSchema).optional(),
  dotacoes: z.array(DotacaoContratoSchema).optional(),
  condicoes: CondicoesContratoSchema.optional(),
  fundamentacao_legal: z.array(z.string()).optional(),
  foro: texto.optional(),
  setores: z.array(ContratoSetorInputSchema).optional(),
  /** Promove RASCUNHO → ATIVA depois da revisão. */
  confirmar: z.boolean().optional(),
});

export type AtualizarContratoInput = z.infer<typeof AtualizarContratoSchema>;
