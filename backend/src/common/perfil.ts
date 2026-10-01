import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "./errors";

const SIGLAS_LICITACOES = new Set(["LIC", "CPL", "LICITACAO", "LICITACOES"]);
const SIGLAS_CONTRATOS = new Set(["FC", "FCON", "FISCAL", "CONTRATOS", "FISCALIZACAO"]);

export type PerfilAcesso = "gabinete" | "licitacoes" | "contratos" | "secretaria" | "fiscal";

function normalizarSigla(sigla?: string): string {
  return sigla?.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() || "";
}

export function obterPerfil(user: Request["user"]): PerfilAcesso {
  if (!user) {
    return "secretaria";
  }

  const siglaSetor = normalizarSigla(user.setor?.sigla);

  if (user.funcao === "PREFEITO" && user.isAdmin) {
    return "gabinete";
  }

  if (user.funcao === "SECRETARIO" && SIGLAS_LICITACOES.has(siglaSetor)) {
    return "licitacoes";
  }

  if (user.funcao === "SECRETARIO" && SIGLAS_CONTRATOS.has(siglaSetor)) {
    return "contratos";
  }

  if (user.funcao === "FISCAL") {
    return "fiscal";
  }

  return "secretaria";
}

// Middleware de autorização baseada no perfil do setor/função do usuário autenticado
export const requerPerfil =
  (...perfis: PerfilAcesso[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const perfil = obterPerfil(req.user);

    if (!perfis.includes(perfil)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };