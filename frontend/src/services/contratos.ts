import { apiRequest } from "./api";
import type {
  Contrato,
  ContratoCondicoes,
  PapelParte,
  PapelSignatario,
  TipoDocumento,
} from "@/types/domain";

// Em produção o backend é outro projeto na Vercel; em desenvolvimento o Vite
// faz proxy de `/api` para localhost:3333 (ver vite.config.ts).
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Resposta do `POST /api/contratos/importar` (após parsing + Zod + persistência).
 * Depois da importação o serviço recarrega o contrato completo para abrir a
 * barra lateral de revisão já preenchida.
 */
export type ImportacaoContratoResult = {
  id: number;
  status: string;
  avisos: string[];
} & Partial<Contrato>;

export interface ParteContratoPayload {
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

export interface SignatarioContratoPayload {
  id?: number;
  papel: PapelSignatario;
  ordem?: number;
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

export interface ItemContratoPayload {
  id?: number;
  codigo: number | null;
  descricao: string;
  unidade: string;
  unidadeOriginal: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal?: number;
}

export interface DotacaoContratoPayload {
  id?: number;
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

/**
 * Payload da revisão manual. Espelha o `GET /api/contratos/:id` (camelCase);
 * `condicoes` continua snake_case porque é o JSON preservado da extração.
 */
export interface AtualizarContratoPayload {
  confirmar?: boolean;
  numero?: string;
  numeroProcesso?: string | null;
  modalidade?: string | null;
  numeroModalidade?: string | null;
  objeto?: string | null;
  valorTotal?: number | null;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  vigenciaFimCalculada?: boolean;
  vigenciaTrecho?: string | null;
  foro?: string | null;
  assinaturaLocal?: string | null;
  assinaturaData?: string | null;
  assinaturaDigital?: boolean;
  assinaturaPlataforma?: string | null;
  assinaturaAssinante?: string | null;
  fundamentacaoLegal?: string[];
  condicoes?: ContratoCondicoes | null;
  partes?: ParteContratoPayload[];
  signatarios?: SignatarioContratoPayload[];
  itens?: ItemContratoPayload[];
  dotacoes?: DotacaoContratoPayload[];
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