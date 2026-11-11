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
// `condicoes` é a exceção: é um JSON preservado da extração, então continua
// snake_case (prazo_execucao, prazo_pagamento, reajuste).

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
  tipoDocumento: TipoDocumentoParteSchema.optional(),
  endereco: textoRevisao,
  representanteNome: textoRevisao,
  representanteCargo: textoRevisao,
  representanteCpf: textoRevisao,
  representanteRg: textoRevisao,
  representanteOrgaoEmissorRg: textoRevisao,
  representanteNacionalidade: textoRevisao,
  representanteEstadoCivil: textoRevisao,
  representanteProfissao: textoRevisao,
  representanteEndereco: textoRevisao,
});

export const SignatarioContratoRevisaoSchema = z.object({
  /** Presente quando o signatário já existe; a revisão substitui a lista inteira. */
  id: z.number().int().positive().optional(),
  papel: z.enum(PAPEIS_SIGNATARIO),
  ordem: z.number().int().nonnegative().optional(),
  nome: textoRevisao,
  cargo: textoRevisao,
  cpf: textoRevisao,
  cnpj: textoRevisao,
  rg: textoRevisao,
  orgaoEmissorRg: textoRevisao,
  nacionalidade: textoRevisao,
  estadoCivil: textoRevisao,
  profissao: textoRevisao,
  endereco: textoRevisao,
  confirmadoNoBloco: z.boolean().optional(),
  legivel: z.boolean().optional(),
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
 * - `confirmar` exige `numero` preenchido;
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
  vigenciaFimCalculada: z.boolean().optional(),
  vigenciaTrecho: textoRevisao,
  foro: textoRevisao,
  assinaturaLocal: textoRevisao,
  assinaturaData: dataRevisao,
  assinaturaDigital: z.boolean().optional(),
  assinaturaPlataforma: textoRevisao,
  assinaturaAssinante: textoRevisao,
  fundamentacaoLegal: z.array(z.string()).optional(),
  condicoes: CondicoesContratoSchema.nullable().optional(),
  partes: z.array(ParteContratoRevisaoSchema).optional(),
  signatarios: z.array(SignatarioContratoRevisaoSchema).optional(),
  itens: z.array(ItemContratoRevisaoSchema).optional(),
  dotacoes: z.array(DotacaoContratoRevisaoSchema).optional(),
  setores: z.array(ContratoSetorInputSchema).optional(),
  /** Promove RASCUNHO → ATIVA depois da revisão. */
  confirmar: z.boolean().optional(),
});

export type AtualizarContratoInput = z.infer<typeof AtualizarContratoSchema>;
export type ParteContratoRevisao = z.infer<typeof ParteContratoRevisaoSchema>;
export type SignatarioContratoRevisao = z.infer<typeof SignatarioContratoRevisaoSchema>;
export type ItemContratoRevisao = z.infer<typeof ItemContratoRevisaoSchema>;
export type DotacaoContratoRevisao = z.infer<typeof DotacaoContratoRevisaoSchema>;
