import { z } from "zod";
import {
  AcaoTomada,
  FuncaoUsuario,
  StatusContrato,
  StatusPedido,
  StatusTermoRenovacao,
  TipoRenovacao,
  TipoSetor,
} from "@prisma/client";

const TIPO_SETOR_VALUES = Object.values(TipoSetor) as [TipoSetor, ...TipoSetor[]];

// Schemas para criar novo setor 
export const CreateSetorSchema = z.object({
  nome: z.string().min(1, "Nome e obrigatorio").trim(),
  sigla: z.string().min(1, "Sigla e obrigatoria").toUpperCase(),
  tipo: z.enum(TIPO_SETOR_VALUES).optional(),
  responsavel: z.string().optional(),
  descricao: z.string().optional(),
  idSetor: z.number().int().positive().optional(),
});

// Schema para atualizar novo setor, campos não obrigatórios.
export const UpdateSetorSchema = CreateSetorSchema.partial()

export type CreateSetorInput = z.infer<typeof CreateSetorSchema>;

export type UpdateSetorInput = z.infer<typeof UpdateSetorSchema>

// Schemas de criação de um novo Usuario
export const CreateUsuarioSchema = z.object({
  nome: z.string().min(1, "Nome e obrigatorio").trim(),
  email: z.string().email("E-mail invalido"),
  senha: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
  funcao: z.enum([
    FuncaoUsuario.PREFEITO,
    FuncaoUsuario.SECRETARIO,
    FuncaoUsuario.SERVIDOR,
    FuncaoUsuario.FISCAL,
  ]),
  isAdmin: z.boolean().optional().default(false),
  idSetor: z.number().int().positive("ID do setor deve ser um numero positivo"),
});

export type CreateUsuarioInput = z.infer<typeof CreateUsuarioSchema>;

// Validção de ID
export const IdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, "ID deve conter apenas numeros")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive("ID deve ser positivo")),
});

export type IdParam = z.infer<typeof IdParamSchema>;

export const UsuarioLoginSchema = z.object({
  email: z.string().email("Email invalido"),
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
  dataPrevistaEntrega: z.coerce.date("Informe o prazo de entrega"),
  observacao: z.string().max(500).trim().optional(),
  itens: z.array(PedidoItemSchema).min(1, "Adicione ao menos um item ao pedido"),
});

export type CreatePedidoInput = z.infer<typeof CreatePedidoSchema>;

const STATUS_PEDIDO_VALUES = Object.values(StatusPedido) as [StatusPedido, ...StatusPedido[]];

export const AtualizarStatusPedidoSchema = z.object({
  status: z.enum(STATUS_PEDIDO_VALUES),
  numeroOrdem: z.string().trim().optional(),
  aviso: z.string().max(1000).trim().optional(),
  // CPF do fiscal — obrigatório (validado no service) quando status = CONCLUIDO
  cpf: z.string().trim().optional(),
  // Observação registrada pelo fiscal na etapa de entrega (detalha o que aconteceu)
  observacao: z.string().max(2000).trim().optional(),
});

export type AtualizarStatusPedidoInput = z.infer<typeof AtualizarStatusPedidoSchema>;

// Aviso do fiscal à secretaria solicitante (problema na entrega, divergência etc.)
export const CreateAvisoPedidoSchema = z.object({
  mensagem: z.string().min(3, "Descreva o aviso").max(1000, "Máximo de 1000 caracteres").trim(),
});

export type CreateAvisoPedidoInput = z.infer<typeof CreateAvisoPedidoSchema>;

// ---- ESTOQUE (notas / baixas) ----

export const NotaFiscalItemSchema = z.object({
  idItemLicitado: z.number().int().positive("Item inválido"),
  quantidade: z.number().int().positive("Quantidade da nota deve ser positiva"),
  valorUnitario: z.number().positive("Valor unitário inválido").optional(),
  marcaConferida: z.boolean().optional(),
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

export const CreateContratanteSchema=z.object({endereco:z.string().optional(),CNPJ:z.string().optional(),nomePrefeito:z.string().optional(),cpfPrefeito:z.number().int().optional(),carteiraIdentidade:z.string().optional(),idLicitacaoContrato:z.number().int().positive().optional()});
export type CreateContratanteInput=z.infer<typeof CreateContratanteSchema>;
export const UpdateContratanteSchema=CreateContratanteSchema.partial();
export type UpdateContratanteInput=z.infer<typeof UpdateContratanteSchema>;



export const CreateSolicitacaoSchema=z.object({idUsuario:z.number().int().positive('Usuario invalido'),idItemLicitado:z.number().int().positive('Item invalido'),dataSolicitacao:z.coerce.date().optional(),quantPedida:z.number().int().positive('Quantidade deve ser positiva')});
export type CreateSolicitacaoInput=z.infer<typeof CreateSolicitacaoSchema>;
export const UpdateSolicitacaoSchema=CreateSolicitacaoSchema.partial();
export type UpdateSolicitacaoInput=z.infer<typeof UpdateSolicitacaoSchema>;


export const CreateContratadoSchema=z.object({nome:z.string().optional(),endereco:z.string().optional(),CNPJ:z.string().optional(),idLicitacaoContrato:z.number().int().positive().optional()});
export type CreateContratadoInput=z.infer<typeof CreateContratadoSchema>;
export const UpdateContratadoSchema=CreateContratadoSchema.partial();
export type UpdateContratadoInput=z.infer<typeof UpdateContratadoSchema>;
