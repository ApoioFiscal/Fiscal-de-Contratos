import { apiRequest } from "./api";
import type {
  AcaoTomada,
  StatusTermoRenovacao,
  TermoRenovacao,
  TipoRenovacao,
} from "@/types/domain";

export interface CriarTermoPayload {
  idContrato: number;
  tipo: TipoRenovacao;
  justificativa: string;
  novaVigenciaFim?: string;
  percentualAcrescimo?: number;
}

export interface AtualizarTermoPayload {
  status: StatusTermoRenovacao;
  parecerLicitacao?: string;
  acaoTomada?: AcaoTomada;
}

export async function listarTermos(status?: StatusTermoRenovacao): Promise<TermoRenovacao[]> {
  const qs = status ? `?status=${status}` : "";
  return apiRequest<TermoRenovacao[]>(`/renovacoes${qs}`);
}

export async function detalharTermo(id: number): Promise<TermoRenovacao> {
  return apiRequest<TermoRenovacao>(`/renovacoes/${id}`);
}

export async function emitirTermo(payload: CriarTermoPayload): Promise<TermoRenovacao> {
  return apiRequest<TermoRenovacao>("/renovacoes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function atualizarTermo(
  id: number,
  payload: AtualizarTermoPayload
): Promise<TermoRenovacao> {
  return apiRequest<TermoRenovacao>(`/renovacoes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}