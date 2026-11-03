export type StatusContrato =
  | "RASCUNHO"
  | "ATIVA"
  | "EM_ADITAMENTO"
  | "ENCERRADA"
  | "VENCIDA";

export type StatusPedido =
  | "PENDENTE"
  | "CONFIRMADO"
  | "EFETUADO"
  | "ENTREGUE"
  | "CONCLUIDO"
  | "DEVOLVIDO"
  | "CANCELADO";

export type TipoHistoricoPedido = "CRIACAO" | "STATUS" | "AVISO";

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

// ---------- CONTRATO (extração real do PDF assinado) ----------

export type PapelParte = "CONTRATANTE" | "CONTRATADO";

export type PapelSignatario = "CONTRATANTE" | "CONTRATADO" | "TESTEMUNHA";

export type TipoDocumento = "CNPJ" | "CPF";

export interface PessoaContrato {
  nome: string | null;
  cargo: string | null;
  cpf: string | null;
  rg: string | null;
  orgaoEmissorRg: string | null;
  nacionalidade: string | null;
  estadoCivil: string | null;
  profissao: string | null;
  endereco: string | null;
}

export interface ContratoParte {
  papel: PapelParte;
  nome: string | null;
  documento: string | null;
  tipoDocumento: TipoDocumento | null;
  endereco: string | null;
  representanteNome: string | null;
  representanteCargo: string | null;
  representanteCpf: string | null;
  representanteRg: string | null;
  representanteOrgaoEmissorRg: string | null;
  representanteNacionalidade: string | null;
  representanteEstadoCivil: string | null;
  representanteProfissao: string | null;
  representanteEndereco: string | null;
}

export interface ContratoSignatario {
  papel: PapelSignatario;
  ordem: number;
  nome: string | null;
  cargo: string | null;
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  orgaoEmissorRg: string | null;
  nacionalidade: string | null;
  estadoCivil: string | null;
  profissao: string | null;
  endereco: string | null;
  confirmadoNoBloco: boolean;
  legivel: boolean;
}

export interface ContratoItem {
  id: number;
  codigo: number | null;
  descricao: string;
  unidade: string;
  unidadeOriginal: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  correcoes: string[];
  recebido: number;
  consumido: number;
}

export interface ContratoDotacao {
  id: number;
  idContrato: number;
  unidadeCodigo: string;
  unidade: string;
  funcionalProgramatica: string | null;
  acao: string | null;
  ficha: string | null;
  elementoCodigo: string | null;
  elementoDescricao: string | null;
  naturezaCodigo: string | null;
  natureza: string | null;
  complemento: string | null;
}

export interface ContratoSetor {
  id: number;
  idContrato: number;
  idSetor: number;
  origem: "DOTACAO" | "MANUAL";
  setor: Setor;
}

export interface Contrato {
  id: number;
  numero: string;
  numeroProcesso: string | null;
  modalidade: string | null;
  numeroModalidade: string | null;
  objeto: string | null;
  valorTotal: number | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  vigenciaFimCalculada: boolean;
  vigenciaTrecho: string | null;
  foro: string | null;
  status: StatusContrato;
  assinaturaLocal: string | null;
  assinaturaData: string | null;
  assinaturaDigital: boolean;
  assinaturaPlataforma: string | null;
  assinaturaAssinante: string | null;
  fundamentacaoLegal: string[];
  condicoes: ContratoCondicoes | null;
  itensConferemTotalTabela: boolean | null;
  itensConferemValorContrato: boolean | null;
  avisos: string[];
  dadosExtraidos: unknown;
  arquivoPdf: string | null;
  arquivoPdfNome: string | null;
  importadoEm: string;
  extraidoEm: string;
  atualizadoEm: string;
  partes: ContratoParte[];
  signatarios: ContratoSignatario[];
  itens: ContratoItem[];
  dotacoes: ContratoDotacao[];
  setores: ContratoSetor[];
}

export interface ContratoCondicoes {
  prazoExecucao: { quantidade: number; unidade: string; marco: string | null } | null;
  prazoPagamento: { quantidade: number; unidade: string } | null;
  reajuste: { prazo: string | null; indice: string | null } | null;
}

// ---------- Pedidos / estoque / avaliações / termos ----------

export interface PedidoItem {
  id: number;
  idPedido: number;
  idContratoItem: number;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  itemContrato?: ItemContratoLite;
}

export interface ItemContratoLite {
  id: number;
  descricao: string;
  unidade: string;
  marca?: string | null;
  quantidade?: number;
  precoUnitario?: number;
}

export interface NotaFiscalResumo {
  id: number;
  numeroNota: string;
  dataEmissao: string;
  dataEntrada: string;
}

export interface PedidoHistorico {
  id: number;
  idPedido: number;
  tipo: TipoHistoricoPedido;
  status: StatusPedido | null;
  mensagem: string | null;
  idUsuario: number;
  data: string;
  usuario?: { id: number; nome: string };
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
  arquivoTermo: string | null;
  dataGeracaoTermo: string | null;
  idContrato: number;
  itens: PedidoItem[];
  contrato?: ContratoResumo;
  setor?: Setor;
  usuario?: { id: number; nome: string };
  notasFiscais?: NotaFiscalResumo[];
  historico?: PedidoHistorico[];
}

export interface ContratoResumo {
  id: number;
  numero: string;
  numeroProcesso: string | null;
  objeto: string | null;
  valorTotal: number | null;
  vigenciaFim: string | null;
  status: StatusContrato;
  partes?: Array<{ nome: string | null; documento: string | null }>;
}

export interface NotaFiscalItem {
  id: number;
  idNotaFiscal: number;
  idContratoItem: number;
  quantidade: number;
  valorUnitario: number;
  itemContrato?: ItemContratoLite;
}

export interface Movimentacao {
  id: number;
  tipo: TipoMovimentacao;
  idContratoItem: number;
  quantidade: number;
  idNotaFiscal: number | null;
  idPedido: number | null;
  data: string;
  observacao: string | null;
  itemContrato?: ItemContratoLite;
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
  contrato?: { id: number; numero: string };
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
  contrato?: ContratoResumo;
  usuarioEmissor?: { id: number; nome: string };
  usuarioLicitacao?: { id: number; nome: string };
  setorSolicitante?: Setor;
}

export interface ItemSaldo {
  id: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  recebido: number;
  consumido: number;
}

export const STATUS_PEDIDO_LABEL: Record<StatusPedido, string> = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Em Compra",
  EFETUADO: "Efetuado",
  ENTREGUE: "Entregue",
  CONCLUIDO: "Concluído",
  DEVOLVIDO: "Devolvido",
  CANCELADO: "Cancelado",
};

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  RASCUNDO: "Rascunho",
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
