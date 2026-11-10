import { apiRequest } from "./api";
import type { Contrato } from "@/types/domain";

// Em produção o backend é outro projeto na Vercel; em desenvolvimento o Vite
// faz proxy de `/api` para localhost:3333 (ver vite.config.ts).
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

/** Resposta do `POST /api/contratos/importar` (após parsing + Zod + persistência). */
export type ImportacaoContratoResult = {
  id: number;
  status: string;
  avisos: string[];
};

export interface AtualizarContratoPayload {
  confirmar?: boolean;
  status?: string;
  numero_contrato?: string | null;
  numero_processo?: string | null;
  modalidade?: string | null;
  numero_modalidade?: string | null;
  objeto?: string | null;
  valor_total?: number | null;
  vigencia?: {
    data_inicio?: string | null;
    data_fim?: string | null;
    data_fim_calculada?: boolean;
    trecho?: string | null;
  } | null;
  setores?: Array<{ idSetor: number; origem?: "DOTACAO" | "MANUAL" }>;
}

export async function listarContratos(): Promise<Contrato[]> {
  return apiRequest<Contrato[]>("/contratos");
}

export async function obterContrato(id: number): Promise<Contrato> {
  return apiRequest<Contrato>(`/contratos/${id}`);
}

export async function importarContratoArquivo(arquivo: File): Promise<ImportacaoContratoResult> {
  const token = localStorage.getItem("token");

  // O backend espera o PDF cru (Content-Type application/pdf) e o encaminha ao parsing.
  // O nome vai na query (?nome=) porque o corpo não é multipart.
  const response = await fetch(
    `${API_BASE_URL}/contratos/importar?nome=${encodeURIComponent(arquivo.name)}`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/pdf",
      },
      body: arquivo,
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: ImportacaoContratoResult; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.success || !payload.data) {
    // O backend devolve mensagens úteis (ex.: contrato já importado → 409);
    // mostra-las na tela evita o genérico "Falha ao importar".
    throw new Error(
      payload?.error?.message ?? "Falha ao importar o contrato a partir do PDF.",
    );
  }

  // Recarrega o contrato persistido para devolver o estado completo (com itens,
  // partes, signatários e avisos) para a tela de revisão.
  const contrato = await obterContrato(payload.data.id).catch(() => null);
  return { ...payload.data, ...(contrato ?? {}) };
}

export async function atualizarContrato(id: number, payload: AtualizarContratoPayload): Promise<Contrato> {
  return apiRequest<Contrato>(`/contratos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function baixarArquivoContrato(id: number): Promise<Blob> {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}/contratos/${id}/arquivo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error("Não foi possível baixar o contrato.");
  }
  return response.blob();
}

export async function excluirContrato(id: number): Promise<void> {
  await apiRequest<void>(`/contratos/${id}`, { method: "DELETE" });
}