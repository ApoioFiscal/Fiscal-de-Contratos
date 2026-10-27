import { Request, Response } from 'express';
import { SolicitacaoService } from './solicitacao.service';

export class SolicitacaoController {
  constructor(private service: SolicitacaoService) {}

  create = async (req: Request, res: Response) => {
    const solicitacao = await this.service.create(req.body);
    return res.status(201).json(solicitacao);
  };

  findAll = async (_req: Request, res: Response) => {
    const solicitacoes = await this.service.findAll();
    return res.json(solicitacoes);
  };

  findById = async (req: Request, res: Response) => {
    const solicitacao = await this.service.findById(Number(req.params.id));
    return res.json(solicitacao);
  };

  update = async (req: Request, res: Response) => {
    const solicitacao = await this.service.update(Number(req.params.id), req.body);
    return res.json(solicitacao);
  };

  delete = async (req: Request, res: Response) => {
    const solicitacao = await this.service.delete(Number(req.params.id));
    return res.json(solicitacao);
  };
}
