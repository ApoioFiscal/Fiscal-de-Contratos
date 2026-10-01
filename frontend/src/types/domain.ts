export type StatusContrato =
  | "RASCUNHO"
  | "ATIVA"
  | "EM_ADITAMENTO"
  | "ENCERRADA"
  | "VENCIDA";

export type StatusPedido =
  | "PENDENTE"
  | "EM_COMPRA"
  | "ENTREGUE"
  | "CONCLUIDO"
  | "RECUSADO"
  | "DEVOLVIDO"
  | "CANCELADO";

export type TipoRenovacao = "VIGENCIA" | "QUANTITATIVO" | "FINANCEIRO";

export type StatusTermoRenovacao = "EMITIDO" | "EM_ANALISE" | "RESOLVIDO" | "ARQUIVADO";

export type AcaoTomada =
  | "ADITIVO_VIGENCIA"
  | "ADITIVO_QUANTITATIVO"
  | "ADITIVO_FINANCEIRO"
  | "NOVA_LICITACAO"
  | "DENEGADO";

export type TipoMovimentacao = "ENTRADA" | "BAIXA";

export interface Setor {
  id: number;
  nome: string;
  sigla: string;
}

export interface ItemLicitado {
  id: number;
  idLicitacao: number;
  descricao: string;
  marca: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  recebido: number;
  consumido: number;
}

export interface LicitacaoSetor {
  idSetor: number;
  setor: Setor;
}

export interface Licitacao {
  id: number;
  numero: string;
  numeroProcesso: string;
  modalidade: string;
  objeto: string;
  fornecedor: string;
  cnpjFornecedor: string;
  dataAbertura: string;
  dataVigenciaFim: string;
  status: StatusContrato;
  valorTotal: number;
  arquivoContrato?: string | null;
  dataGeracaoContrato?: string | null;
  itens: ItemLicitado[];
  setores: LicitacaoSetor[];
}

export interface PedidoItem {
  id: number;
  idPedido: number;
  idItemLicitado: number;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  itemLicitado?: ItemLicitado;
}

export interface NotaFiscalResumo {
  id: number;
  numeroNota: string;
  dataEmissao: string;
  dataEntrada: string;
}

export interface Pedido {
  id: number;
  numeroPedido: string;
  dataPedido: string;
  dataPrevistaEntrega: string | null;
  status: StatusPedido;
  numeroOrdem: string | null;
  dataOrdem: string | null;
  observacao: string | null;
  idContrato: number;
  itens: PedidoItem[];
  contrato?: Pick<Licitacao, "id" | "numero" | "numeroProcesso" | "fornecedor" | "cnpjFornecedor">;
  setor?: Setor;
  usuario?: { id: number; nome: string };
  notasFiscais?: NotaFiscalResumo[];
}

export interface NotaFiscalItem {
  id: number;
  idNotaFiscal: number;
  idItemLicitado: number;
  quantidade: number;
  valorUnitario: number;
  itemLicitado?: Pick<ItemLicitado, "id" | "descricao" | "unidade">;
}

export interface Movimentacao {
  id: number;
  tipo: TipoMovimentacao;
  idItemLicitado: number;
  quantidade: number;
  idNotaFiscal: number | null;
  idPedido: number | null;
  data: string;
  observacao: string | null;
  itemLicitado?: Pick<ItemLicitado, "id" | "descricao" | "unidade" | "idLicitacao">;
  pedido?: { id: number; numeroPedido: string };
  notaFiscal?: { id: number; numeroNota: string };
}

export interface NotaFiscal {
  id: number;
  numeroNota: string;
  dataEmissao: string;
  dataEntrada: string;
  observacao: string | null;
  idPedido: number;
  idContrato: number;
  itens: NotaFiscalItem[];
  movimentacoes: Movimentacao[];
  pedido?: { id: number; numeroPedido: string; status: StatusPedido };
  contrato?: { id: number; numero: string };
}

export interface Avaliacao {
  id: number;
  idPedido: number;
  idContrato: number;
  idUsuarioFiscal: number;
  dataAvaliacao: string;
  notaEntrega: number;
  notaPrazo: number;
  possuiProblema: boolean;
  descricaoProblema: string | null;
  observacao: string | null;
  pedido?: { numeroPedido: string; status: StatusPedido };
  contrato?: { id: number; numero: string; fornecedor: string };
  usuarioFiscal?: { nome: string };
}

export interface ResumoAvaliacao {
  idContrato: number;
  totalAvaliacoes: number;
  mediaNotaEntrega: number | null;
  mediaNotaPrazo: number | null;
  entregasComProblema: number;
  problemas: { idAvaliacao: number; numeroPedido: string; descricao: string }[];
}

export interface TermoRenovacao {
  id: number;
  idContrato: number;
  tipo: TipoRenovacao;
  status: StatusTermoRenovacao;
  justificativa: string;
  novaVigenciaFim: string | null;
  percentualAcrescimo: number | null;
  parecerLicitacao: string | null;
  acaoTomada: AcaoTomada | null;
  dataEmissao: string;
  dataResolucao: string | null;
  contrato?: Pick<Licitacao, "id" | "numero" | "fornecedor" | "dataVigenciaFim" | "status">;
  usuarioEmissor?: { id: number; nome: string };
  usuarioLicitacao?: { id: number; nome: string };
}

export interface ItemSaldo {
  id: number;
  descricao: string;
  marca: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  recebido: number;
  consumido: number;
}

export const STATUS_PEDIDO_LABEL: Record<StatusPedido, string> = {
  PENDENTE: "Pendente",
  EM_COMPRA: "Em Compra",
  ENTREGUE: "Entregue",
  CONCLUIDO: "Concluído",
  RECUSADO: "Recusado",
  DEVOLVIDO: "Devolvido",
  CANCELADO: "Cancelado",
};

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  RASCUNHO: "Rascunho",
  ATIVA: "Ativa",
  EM_ADITAMENTO: "Em Aditamento",
  ENCERRADA: "Encerrada",
  VENCIDA: "Vencida",
};

export const TIPO_RENOVACAO_LABEL: Record<TipoRenovacao, string> = {
  VIGENCIA: "Vigência",
  QUANTITATIVO: "Quantitativo",
  FINANCEIRO: "Financeiro",
};

export const STATUS_TERMO_LABEL: Record<StatusTermoRenovacao, string> = {
  EMITIDO: "Emitido",
  EM_ANALISE: "Em Análise",
  RESOLVIDO: "Resolvido",
  ARQUIVADO: "Arquivado",
};

export const ACAO_TOMADA_LABEL: Record<AcaoTomada, string> = {
  ADITIVO_VIGENCIA: "Aditivo de Vigência",
  ADITIVO_QUANTITATIVO: "Aditivo Quantitativo",
  ADITIVO_FINANCEIRO: "Aditivo Financeiro",
  NOVA_LICITACAO: "Nova Licitação",
  DENEGADO: "Negado",
};