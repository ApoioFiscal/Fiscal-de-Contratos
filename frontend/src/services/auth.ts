import { jwtDecode } from "jwt-decode";

import type {
  FuncaoUsuario,
  JwtPayloadAutenticado,
  PerfilAcesso,
  SetorResumo,
  UsuarioAutenticado,
} from "@/types/auth";
import { apiRequest, definirTratadorNaoAutorizado } from "./api";

const AUTH_USER_KEY = "usuario";
const TOKEN_KEY = "token";
const LEGACY_AUTH_KEY = "isAuthenticated";
const LEGACY_ROLE_KEY = "userRole";

const SIGLAS_LICITACOES = new Set(["LIC", "CPL", "LICITACAO", "LICITACOES"]);
const SIGLAS_CONTRATOS = new Set(["FC", "FCON", "FISCAL", "CONTRATOS", "FISCALIZACAO"]);

interface CredenciaisLogin {
  email: string;
  senha: string;
}

function isFuncaoUsuario(value: unknown): value is FuncaoUsuario {
  return (
    value === "PREFEITO" ||
    value === "SECRETARIO" ||
    value === "SERVIDOR" ||
    value === "FISCAL"
  );
}

function isSetorResumo(value: unknown): value is SetorResumo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const setor = value as Partial<SetorResumo>;
  return (
    typeof setor.id === "number" &&
    typeof setor.nome === "string" &&
    typeof setor.sigla === "string"
  );
}

function isJwtPayloadAutenticado(value: unknown): value is JwtPayloadAutenticado {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<JwtPayloadAutenticado>;
  return (
    typeof payload.id === "number" &&
    typeof payload.email === "string" &&
    isFuncaoUsuario(payload.funcao) &&
    typeof payload.isAdmin === "boolean"
  );
}

function normalizarSigla(sigla?: string): string {
  return sigla?.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() || "";
}

export function inferirPerfil(payload: JwtPayloadAutenticado): PerfilAcesso {
  const siglaSetor = normalizarSigla(payload.setor?.sigla);

  if (payload.funcao === "PREFEITO" && payload.isAdmin) {
    return "gabinete";
  }

  if (payload.funcao === "SECRETARIO" && SIGLAS_LICITACOES.has(siglaSetor)) {
    return "licitacoes";
  }

  if (payload.funcao === "SECRETARIO" && SIGLAS_CONTRATOS.has(siglaSetor)) {
    return "contratos";
  }

  if (payload.funcao === "FISCAL") {
    return "fiscal";
  }

  return "secretaria";
}

function usuarioFromPayload(payload: JwtPayloadAutenticado): UsuarioAutenticado {
  const setor = isSetorResumo(payload.setor) ? payload.setor : undefined;

  return {
    id: payload.id,
    nome: payload.nome?.trim() || payload.email,
    email: payload.email,
    funcao: payload.funcao,
    isAdmin: payload.isAdmin,
    idSetor: payload.idSetor ?? setor?.id,
    setor,
    perfil: inferirPerfil(payload),
  };
}

export function encerrarSessao(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(LEGACY_AUTH_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);
}

export function salvarSessao(token: string): UsuarioAutenticado {
  const payload: unknown = jwtDecode(token);

  if (!isJwtPayloadAutenticado(payload)) {
    throw new Error("Token de autenticação inválido.");
  }

  const usuario = usuarioFromPayload(payload);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(usuario));
  localStorage.removeItem(LEGACY_AUTH_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);

  return usuario;
}

export function obterSessao(): UsuarioAutenticado | null {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    return null;
  }

  try {
    return salvarSessao(token);
  } catch {
    encerrarSessao();
    return null;
  }
}

export function tokenExpirado(token: string): boolean {
  try {
    const payload: unknown = jwtDecode(token);

    if (!isJwtPayloadAutenticado(payload) || !payload.exp) {
      return false;
    }

    return payload.exp < Date.now() / 1000;
  } catch {
    return true;
  }
}

export async function login(credenciais: CredenciaisLogin): Promise<UsuarioAutenticado> {
  const token = await apiRequest<string>("/usuarios/login", {
    method: "POST",
    body: JSON.stringify(credenciais),
  });

  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Resposta de autenticação inválida.");
  }

  return salvarSessao(token);
}

export function destinoInicialPorPerfil(perfil: PerfilAcesso): string {
  if (perfil === "gabinete") {
    return "/secretarias";
  }

  if (perfil === "licitacoes") {
    return "/licitacoes";
  }

  return "/";
}

definirTratadorNaoAutorizado(() => {
  encerrarSessao();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
});
