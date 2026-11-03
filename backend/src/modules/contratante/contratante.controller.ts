import { Request, Response } from 'express';
import { ContratanteService } from './contratante.service';

export class ContratanteController {
  constructor(private service: ContratanteService) {}

  create = async (req: Request, res: Response) => {
    const contratante = await this.service.create(req.body);
    return res.status(201).json(contratante);
  };

  findAll = async (_req: Request, res: Response) => {
    const contratantes = await this.service.findAll();
    return res.json(contratantes);
  };

  findById = async (req: Request, res: Response) => {
    const contratante = await this.service.findById(Number(req.params.id));
    return res.json(contratante);
  };

  update = async (req: Request, res: Response) => {
    const contratante = await this.service.update(Number(req.params.id), req.body);
    return res.json(contratante);
  };

  delete = async (req: Request, res: Response) => {
    const contratante = await this.service.delete(Number(req.params.id));
    return res.json(contratante);
  };
}
