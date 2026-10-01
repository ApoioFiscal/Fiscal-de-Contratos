import { apiRequest } from "./api";
import type { Avaliacao, ResumoAvaliacao } from "@/types/domain";

export interface CriarAvaliacaoPayload {
  idPedido: number;
  notaEntrega: number;
  notaPrazo: number;
  possuiProblema?: boolean;
  descricaoProblema?: string;
  observacao?: string;
}

export async function listarAvaliacoes(contratoId?: number): Promise<Avaliacao[]> {
  const qs = contratoId ? `?contratoId=${contratoId}` : "";
  return apiRequest<Avaliacao[]>(`/avaliacoes${qs}`);
}

export async function criarAvaliacao(payload: CriarAvaliacaoPayload): Promise<Avaliacao> {
  return apiRequest<Avaliacao>("/avaliacoes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resumoFornecedor(idContrato: number): Promise<ResumoAvaliacao> {
  return apiRequest<ResumoAvaliacao>(`/avaliacoes/resumo/${idContrato}`);
}