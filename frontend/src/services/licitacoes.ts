import { apiRequest } from "./api";
import type { Licitacao } from "@/types/domain";

export interface CriarLicitacaoPayload {
  numero: string;
  numeroProcesso: string;
  modalidade: string;
  objeto: string;
  fornecedor: string;
  cnpjFornecedor: string;
  dataAbertura: string;
  dataVigenciaFim: string;
  status?: string;
  idSetores: number[];
  itens: {
    descricao: string;
    marca?: string;
    unidade: string;
    quantidade: number;
    precoUnitario: number;
  }[];
}

export async function listarLicitacoes(): Promise<Licitacao[]> {
  return apiRequest<Licitacao[]>("/licitacoes");
}

export async function obterLicitacao(id: number): Promise<Licitacao> {
  return apiRequest<Licitacao>(`/licitacoes/${id}`);
}

export async function criarLicitacao(payload: CriarLicitacaoPayload): Promise<Licitacao> {
  return apiRequest<Licitacao>("/licitacoes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function atualizarLicitacao(
  id: number,
  payload: Partial<CriarLicitacaoPayload>
): Promise<Licitacao> {
  return apiRequest<Licitacao>(`/licitacoes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function gerarContratoLicitacao(id: number): Promise<Licitacao> {
  return apiRequest<Licitacao>(`/licitacoes/${id}/gerar-contrato`, {
    method: "POST",
  });
}

export async function baixarArquivoContrato(id: number): Promise<Blob> {
  const token = localStorage.getItem("token");
  const response = await fetch(`/api/licitacoes/${id}/arquivo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error("Não foi possível baixar o arquivo do contrato.");
  }
  return response.blob();
}