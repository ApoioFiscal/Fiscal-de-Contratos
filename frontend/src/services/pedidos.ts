import { apiRequest } from "./api";
import type { Pedido, StatusPedido } from "@/types/domain";

export interface CriarPedidoPayload {
  idContrato: number;
  dataPrevistaEntrega: string;
  observacao?: string;
  itens: { idItemLicitado: number; quantidade: number }[];
}

export interface AtualizarStatusPedidoPayload {
  status: StatusPedido;
  numeroOrdem?: string;
  aviso?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

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

export async function registrarAvisoPedido(
  id: number,
  mensagem: string
): Promise<Pedido> {
  return apiRequest<Pedido>(`/pedidos/${id}/avisos`, {
    method: "POST",
    body: JSON.stringify({ mensagem }),
  });
}

export async function baixarTermoRecebimento(id: number, cpf?: string): Promise<void> {
  const token = localStorage.getItem("token");
  const query = cpf?.trim() ? `?cpf=${encodeURIComponent(cpf.trim())}` : "";
  const response = await fetch(`${API_BASE_URL}/pedidos/${id}/termo${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error("Não foi possível gerar o termo de recebimento.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `TERMO-RECEBIMENTO-${id}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}