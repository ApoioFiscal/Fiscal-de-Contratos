// Setores raízes do sistema: não podem ser excluídos (apenas ter o
// responsável/usuário vinculado editado pela tela de Setores e Secretarias).
export const SIGLAS_SETORES_RAIZ = ["GAB", "LIC", "FCON", "CMP"] as const;

export const NOMES_SETORES_RAIZ: Record<string, string> = {
  GAB: "Gabinete",
  LIC: "Licitações",
  FCON: "Fiscalização de Contratos",
  CMP: "Compras",
};

export function normalizarSigla(sigla?: string | null): string {
  return (
    sigla
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() || ""
  );
}

export function ehSetorRaiz(sigla?: string | null): boolean {
  return (SIGLAS_SETORES_RAIZ as readonly string[]).includes(normalizarSigla(sigla));
}
