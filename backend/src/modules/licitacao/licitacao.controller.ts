import { Request, Response } from "express";
import { LicitacaoService } from "./licitacao.service";
import { sendSuccess } from "../../common/middleware";

export class LicitacaoController {
  constructor(private service: LicitacaoService) {}

  async create(req: Request, res: Response): Promise<void> {
    const licitacao = await this.service.create(req.body);
    sendSuccess(res, licitacao, 201);
  }

  async findAll(req: Request, res: Response): Promise<void> {
    const licitacoes = await this.service.findAll();
    sendSuccess(res, licitacoes);
  }

  async findById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const licitacao = await this.service.findById(id);
    sendSuccess(res, licitacao);
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const licitacao = await this.service.update(id, req.body);
    sendSuccess(res, licitacao);
  }

  async gerarContrato(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const licitacao = await this.service.gerarContrato(id);
    sendSuccess(res, licitacao);
  }

  async downloadContrato(req: Request, res: Response): Promise<void> {
    const { caminho, filename } = await this.service.obterArquivoContrato(Number(req.params.id));
    res.download(caminho, filename);
  }
}