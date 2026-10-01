import { Request, Response } from "express";
import { AvaliacaoService } from "./avaliacao.service";
import { sendSuccess } from "../../common/middleware";

export class AvaliacaoController {
  constructor(private service: AvaliacaoService) {}

  async create(req: Request, res: Response): Promise<void> {
    const usuario = { id: req.user?.id as number };
    const avaliacao = await this.service.create(usuario, req.body);
    sendSuccess(res, avaliacao, 201);
  }

  async listar(req: Request, res: Response): Promise<void> {
    const { contratoId } = req.query;
    const avaliacoes = await this.service.listar(
      contratoId ? Number(contratoId) : undefined
    );
    sendSuccess(res, avaliacoes);
  }

  async resumoFornecedor(req: Request, res: Response): Promise<void> {
    const idContrato = Number(req.params.id);
    const resumo = await this.service.resumoFornecedor(idContrato);
    sendSuccess(res, resumo);
  }
}