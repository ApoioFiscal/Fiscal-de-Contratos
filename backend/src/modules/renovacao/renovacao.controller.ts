import { Request, Response } from "express";
import { TermoRenovacaoService } from "./renovacao.service";
import { sendSuccess } from "../../common/middleware";
import { TermoRenovacaoQuerySchema } from "../../common/schemas";

export class TermoRenovacaoController {
  constructor(private service: TermoRenovacaoService) {}

  async emitir(req: Request, res: Response): Promise<void> {
    const usuario = { id: req.user?.id as number };
    const termo = await this.service.emitir(usuario, req.body);
    sendSuccess(res, termo, 201);
  }

  async listar(req: Request, res: Response): Promise<void> {
    const query = TermoRenovacaoQuerySchema.parse(req.query);
    const termos = await this.service.listar(query.status);
    sendSuccess(res, termos);
  }

  async detalhe(req: Request, res: Response): Promise<void> {
    const termo = await this.service.detalhe(Number(req.params.id));
    sendSuccess(res, termo);
  }

  async alterarStatus(req: Request, res: Response): Promise<void> {
    const usuario = { id: req.user?.id as number };
    const termo = await this.service.alterarStatus(usuario, Number(req.params.id), req.body);
    sendSuccess(res, termo);
  }
}