import { Request, Response, NextFunction } from "express";
import {  ZodSchema } from "zod";
import { AppError, ForbiddenError, UnauthorizedError, ValidationError } from "./errors";
import { ParamsDictionary } from "express-serve-static-core"
import  jwt  from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

interface SetorPayload {
  id: number;
  nome: string;
  sigla: string;
}

interface JwtPayload {
  id: number;
  email: string;
  nome?: string;
  funcao?: string;
  isAdmin?: boolean;
  idSetor?: number;
  setor?: SetorPayload;
}

// Estender tipo Request para incluir usuário autenticado
// (aumentação global definida em src/@types/express/index.d.ts)

// Handler Assíncrono
// Wrapper que captura erros assíncronos e passa para o error handler
export const asyncHandler = (
  fn: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void>
) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

//  Middleware para validar body com schema Zod
export const validateBody = (schema: ZodSchema) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      const issues = error?.issues ?? error?.errors ?? [];
      const details = issues.reduce((acc: any, err: any) => {
        acc[err.path.join(".")] = err.message;
        return acc;
      }, {});

      next(new ValidationError("Dados inválidos", details));
    }
  };
};

// Middleware para validar params com schema Zod
export const validateParams = (schema: ZodSchema) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const validated = schema.parse(req.params) as ParamsDictionary;
      req.params = validated;
      next();
    } catch {
      next(new ValidationError("Parâmetros inválidos"));
    }
  };
};

// Middleware de autenticação com jsonWebToken
export const autenticationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Pega os headers da requisição
  const authHeader = req.headers.authorization;

  // Caso não tenha token retorna erro
  if(!authHeader){
    throw new UnauthorizedError("Token não informado");
  }

  const [type, token] = authHeader.split(" ")

  if(type != "Bearer"){
    throw new UnauthorizedError("Formato de token inválido");
  }

  try{
    // Verifica a assinatura do token, se estiver tudo certo chama a próxima parte.
    const payload = jwt.verify(
      token,
      JWT_SECRET
    ) as JwtPayload;

    req.user = payload;

    next()
  }catch{
    throw new UnauthorizedError("Token inválido ou expirado")
  }
}

// Middleware de autorização: exige usuário autenticado com isAdmin = true
export const requerAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.isAdmin) {
    next(new ForbiddenError());
    return;
  }

  next();
}

//  ERROR HANDLER 

// Middleware global de tratamento de erros
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("[ERROR]", err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Erro desconhecido
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Erro interno do servidor",
    },
  });
};

//  RESPONSE HELPER 
/**
 * Tipos de resposta estruturados
 */
export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
};

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Helper para enviar respostas padronizadas de sucesso
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200
) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};
