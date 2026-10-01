import "express"

declare module "express-serve-static-core"{
    interface Request {
        user?: {
            id: number;
            email: string;
            nome?: string;
            funcao?: string;
            isAdmin?: boolean;
            idSetor?: number;
            setor?: {
                id: number;
                nome: string;
                sigla: string;
            };
        }
    }
}