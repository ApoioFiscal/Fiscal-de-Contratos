import { apiRequest } from "./api";
import type { Pedido, StatusPedido } from "@/types/domain";

export interface CriarPedidoPayload {
  idContrato: number;
  dataPrevistaEntrega?: string;
  observacao?: string;
  itens: { idItemLicitado: number; quantidade: number }[];
}

export interface AtualizarStatusPedidoPayload {
  status: StatusPedido;
  numeroOrdem?: string;
  dataPrevistaEntrega?: string;
}

export async function listarPedidos(): Promise<Pedido[]> {
  return apiRequest<Pedido[]>("/pedidos");
}

export async function listarMeusPedidos(): Promise<Pedido[]> {
  return apiRequest<Pedido[]>("/pedidos/meus");
}

export async function listarFilaPedidos(): Promise<Pedido[]> {
  return apiRequest<Pedido[]>("/pedidos/fila");
}

export async function detalharPedido(id: number): Promise<Pedido> {
  return apiRequest<Pedido>(`/pedidos/${id}`);
}

export async function criarPedido(payload: CriarPedidoPayload): Promise<Pedido> {
  return apiRequest<Pedido>("/pedidos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function atualizarStatusPedido(
  id: number,
  payload: AtualizarStatusPedidoPayload
): Promise<Pedido> {
  return apiRequest<Pedido>(`/pedidos/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}