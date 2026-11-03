import { Request, Response } from 'express';
import { ContratadoService } from './contratado.service';

export class ContratadoController {
  constructor(private service: ContratadoService) {}

  create = async (req: Request, res: Response) => {
    const contratado = await this.service.create(req.body);
    return res.status(201).json(contratado);
  };

  findAll = async (_req: Request, res: Response) => {
    const contratados = await this.service.findAll();
    return res.json(contratados);
  };

  findById = async (req: Request, res: Response) => {
    const contratado = await this.service.findById(Number(req.params.id));
    return res.json(contratado);
  };

  update = async (req: Request, res: Response) => {
    const contratado = await this.service.update(Number(req.params.id), req.body);
    return res.json(contratado);
  };

  delete = async (req: Request, res: Response) => {
    const contratado = await this.service.delete(Number(req.params.id));
    return res.json(contratado);
  };
}
