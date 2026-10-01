export type FuncaoUsuario = "PREFEITO" | "SECRETARIO" | "SERVIDOR" | "FISCAL";

export type PerfilAcesso =
  | "gabinete"
  | "licitacoes"
  | "contratos"
  | "secretaria"
  | "fiscal";

export interface SetorResumo {
  id: number;
  nome: string;
  sigla: string;
}

export interface JwtPayloadAutenticado {
  id: number;
  nome?: string;
  email: string;
  funcao: FuncaoUsuario;
  isAdmin: boolean;
  idSetor?: number;
  setor?: SetorResumo;
  exp?: number;
  iat?: number;
}

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  funcao: FuncaoUsuario;
  isAdmin: boolean;
  idSetor?: number;
  setor?: SetorResumo;
  perfil: PerfilAcesso;
}
