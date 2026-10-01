import { Request, Response } from "express";
import { EstoqueService } from "./estoque.service";
import { sendSuccess } from "../../common/middleware";
import { EstoqueQuerySchema } from "../../common/schemas";

export class EstoqueController {
  constructor(private service: EstoqueService) {}

  async entradaNota(req: Request, res: Response): Promise<void> {
    const nota = await this.service.entradaNota(req.body);
    sendSuccess(res, nota, 201);
  }

  async baixa(req: Request, res: Response): Promise<void> {
    const movimentacao = await this.service.baixa(req.body);
    sendSuccess(res, movimentacao, 201);
  }

  async listar(req: Request, res: Response): Promise<void> {
    const query = EstoqueQuerySchema.parse(req.query);
    const movimentacoes = await this.service.listarMovimentacoes(query);
    sendSuccess(res, movimentacoes);
  }

  async resumoContrato(req: Request, res: Response): Promise<void> {
    const idContrato = Number(req.params.id);
    const resumo = await this.service.resumoContrato(idContrato);
    sendSuccess(res, resumo);
  }
}