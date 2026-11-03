import { apiRequest } from "./api";
import type { ItemSaldo, Movimentacao, NotaFiscal } from "@/types/domain";

export interface EntradaNotaPayload {
  idPedido: number;
  numeroNota: string;
  dataEmissao: string;
  observacao?: string;
  itens: {
    idContratoItem: number;
    quantidade: number;
    valorUnitario?: number;
    marcaConferida?: boolean;
  }[];
}

export interface BaixaPayload {
  idContratoItem: number;
  quantidade: number;
  idPedido?: number;
  observacao?: string;
}

export async function registrarEntradaNota(payload: EntradaNotaPayload): Promise<NotaFiscal> {
  return apiRequest<NotaFiscal>("/estoque", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registrarBaixa(payload: BaixaPayload): Promise<Movimentacao> {
  return apiRequest<Movimentacao>("/estoque/baixas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listarMovimentacoes(params: {
  itemContratoId?: number;
  contratoId?: number;
}): Promise<Movimentacao[]> {
  const query = new URLSearchParams();
  if (params.itemContratoId) query.set("itemContratoId", String(params.itemContratoId));
  if (params.contratoId) query.set("contratoId", String(params.contratoId));
  const qs = query.toString();
  return apiRequest<Movimentacao[]>(`/estoque${qs ? `?${qs}` : ""}`);
}

export async function resumoContrato(idContrato: number): Promise<ItemSaldo[]> {
  return apiRequest<ItemSaldo[]>(`/estoque/contrato/${idContrato}`);
}
