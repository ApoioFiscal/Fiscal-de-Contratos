import { z } from "zod";
import {
  AcaoTomada,
  FuncaoUsuario,
  StatusContrato,
  StatusPedido,
  StatusTermoRenovacao,
  TipoRenovacao,
} from "@prisma/client";

// Schemas para criar novo setor 
export const CreateSetorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").trim(),
  sigla: z.string().min(1, "Sigla é obrigatória").toUpperCase(),
});

// Schema para atualizar novo setor, campos não obrigatórios.
export const UpdateSetorSchema = CreateSetorSchema.partial()

export type CreateSetorInput = z.infer<typeof CreateSetorSchema>;

export type UpdateSetorInput = z.infer<typeof UpdateSetorSchema>

// Schemas de criação de um novo Usuario
export const CreateUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").trim(),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  funcao: z.enum([
    FuncaoUsuario.PREFEITO,
    FuncaoUsuario.SECRETARIO,
    FuncaoUsuario.SERVIDOR,
    FuncaoUsuario.FISCAL,
  ]),
  isAdmin: z.boolean().optional().default(false),
  idSetor: z.number().int().positive("ID do setor deve ser um número positivo"),
});

export type CreateUsuarioInput = z.infer<typeof CreateUsuarioSchema>;

// Validção de ID
export const IdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, "ID deve conter apenas números")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive("ID deve ser positivo")),
});

export type IdParam = z.infer<typeof IdParamSchema>;

export const UsuarioLoginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve conter no minimo 6 caracteres")
})

export type LoginUserInput = z.infer<typeof UsuarioLoginSchema>;

// ---- LICITAÇÕES / CONTRATOS ----

export const ItemLicitadoSchema = z.object({
  descricao: z.string().min(1, "Descrição do item é obrigatória").trim(),
  marca: z.string().max(120).optional().default(""),
  unidade: z.string().min(1, "Unidade é obrigatória").trim(),
  quantidade: z.number().int().positive("Quantidade deve ser positiva"),
  precoUnitario: z.number().positive("Preço unitário deve ser positivo"),
});

export type ItemLicitadoInput = z.infer<typeof ItemLicitadoSchema>;

const STATUS_CONTRATO_VALUES = Object.values(StatusContrato) as [StatusContrato, ...StatusContrato[]];

export const CreateLicitacaoSchema = z.object({
  numero: z.string().min(1, "Número do contrato é obrigatório").trim(),
  numeroProcesso: z.string().min(1, "Número do processo é obrigatório").trim(),
  modalidade: z.string().min(1, "Modalidade é obrigatória").trim(),
  objeto: z.string().min(1, "Objeto é obrigatório").trim(),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório").trim(),
  cnpjFornecedor: z
    .string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido"),
  dataAbertura: z.coerce.date("Data de abertura inválida"),
  dataVigenciaFim: z.coerce.date("Data de vigência final inválida"),
  status: z.enum(STATUS_CONTRATO_VALUES).optional().default(StatusContrato.RASCUNHO),
  idSetores: z.array(z.number().int().positive()).min(1, "Selecione ao menos uma secretaria"),
  itens: z.array(ItemLicitadoSchema).min(1, "Cadastre ao menos um item"),
});

export type CreateLicitacaoInput = z.infer<typeof CreateLicitacaoSchema>;

export const UpdateLicitacaoSchema = CreateLicitacaoSchema.partial();

export type UpdateLicitacaoInput = z.infer<typeof UpdateLicitacaoSchema>;

// ---- PEDIDOS ----

export const PedidoItemSchema = z.object({
  idItemLicitado: z.number().int().positive("Item inválido"),
  quantidade: z.number().int().positive("Quantidade deve ser positiva"),
});

export type PedidoItemInput = z.infer<typeof PedidoItemSchema>;

export const CreatePedidoSchema = z.object({
  idContrato: z.number().int().positive("Contrato inválido"),
  dataPrevistaEntrega: z.coerce.date().optional(),
  observacao: z.string().max(500).trim().optional(),
  itens: z.array(PedidoItemSchema).min(1, "Adicione ao menos um item ao pedido"),
});

export type CreatePedidoInput = z.infer<typeof CreatePedidoSchema>;

const STATUS_PEDIDO_VALUES = Object.values(StatusPedido) as [StatusPedido, ...StatusPedido[]];

export const AtualizarStatusPedidoSchema = z.object({
  status: z.enum(STATUS_PEDIDO_VALUES),
  numeroOrdem: z.string().trim().optional(),
  dataPrevistaEntrega: z.coerce.date().optional(),
});

export type AtualizarStatusPedidoInput = z.infer<typeof AtualizarStatusPedidoSchema>;

// ---- ESTOQUE (notas / baixas) ----

export const NotaFiscalItemSchema = z.object({
  idItemLicitado: z.number().int().positive("Item inválido"),
  quantidade: z.number().int().positive("Quantidade da nota deve ser positiva"),
  valorUnitario: z.number().positive("Valor unitário inválido").optional(),
});

export type NotaFiscalItemInput = z.infer<typeof NotaFiscalItemSchema>;

export const CreateNotaFiscalSchema = z.object({
  idPedido: z.number().int().positive("Pedido inválido"),
  numeroNota: z.string().min(1, "Número da nota é obrigatório").trim(),
  dataEmissao: z.coerce.date("Data de emissão inválida"),
  observacao: z.string().max(500).trim().optional(),
  itens: z.array(NotaFiscalItemSchema).min(1, "Informe ao menos um item da nota"),
});

export type CreateNotaFiscalInput = z.infer<typeof CreateNotaFiscalSchema>;

export const CreateBaixaSchema = z.object({
  idItemLicitado: z.number().int().positive("Item inválido"),
  quantidade: z.number().int().positive("Quantidade da baixa deve ser positiva"),
  idPedido: z.number().int().positive().optional(),
  observacao: z.string().max(500).trim().optional(),
});

export type CreateBaixaInput = z.infer<typeof CreateBaixaSchema>;

export const EstoqueQuerySchema = z.object({
  itemLicitadoId: z.coerce.number().int().positive().optional(),
  contratoId: z.coerce.number().int().positive().optional(),
});

export type EstoqueQuery = z.infer<typeof EstoqueQuerySchema>;

// ---- AVALIAÇÃO DO FORNECEDOR ----

export const CreateAvaliacaoSchema = z.object({
  idPedido: z.number().int().positive("Pedido inválido"),
  notaEntrega: z.number().int().min(1).max(5, "Nota de entrega deve estar entre 1 e 5"),
  notaPrazo: z.number().int().min(1).max(5, "Nota de prazo deve estar entre 1 e 5"),
  possuiProblema: z.boolean().optional().default(false),
  descricaoProblema: z.string().max(1000).trim().optional(),
  observacao: z.string().max(1000).trim().optional(),
});

export type CreateAvaliacaoInput = z.infer<typeof CreateAvaliacaoSchema>;

// ---- TERMOS DE RENOVAÇÃO ----

const TIPO_RENOVACAO_VALUES = Object.values(TipoRenovacao) as [TipoRenovacao, ...TipoRenovacao[]];
const STATUS_TERMO_VALUES = Object.values(StatusTermoRenovacao) as [
  StatusTermoRenovacao,
  ...StatusTermoRenovacao[],
];
const ACAO_TOMADA_VALUES = Object.values(AcaoTomada) as [AcaoTomada, ...AcaoTomada[]];

export const CreateTermoRenovacaoSchema = z.object({
  idContrato: z.number().int().positive("Contrato inválido"),
  tipo: z.enum(TIPO_RENOVACAO_VALUES),
  justificativa: z.string().min(10, "Justificativa deve ter ao menos 10 caracteres").trim(),
  novaVigenciaFim: z.coerce.date().optional(),
  percentualAcrescimo: z.number().positive().max(25, "Acréscimo máx. de 25%").optional(),
});

export type CreateTermoRenovacaoInput = z.infer<typeof CreateTermoRenovacaoSchema>;

export const AtualizarTermoRenovacaoSchema = z.object({
  status: z.enum(STATUS_TERMO_VALUES),
  parecerLicitacao: z.string().max(1000).trim().optional(),
  acaoTomada: z.enum(ACAO_TOMADA_VALUES).optional(),
});

export type AtualizarTermoRenovacaoInput = z.infer<typeof AtualizarTermoRenovacaoSchema>;

export const TermoRenovacaoQuerySchema = z.object({
  status: z.enum(STATUS_TERMO_VALUES).optional(),
});

export type TermoRenovacaoQuery = z.infer<typeof TermoRenovacaoQuerySchema>;