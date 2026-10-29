export type FuncaoUsuario = "PREFEITO" | "SECRETARIO" | "SERVIDOR" | "FISCAL";

export type TipoSetor = "GABINETE" | "SETOR" | "SECRETARIA";

export type PerfilAcesso =
  | "gabinete"
  | "licitacoes"
  | "contratos"
  | "secretaria"
  | "fiscal"
  | "compras";

export interface SetorResumo {
  id: number;
  nome: string;
  sigla: string;
  tipo?: TipoSetor;
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
