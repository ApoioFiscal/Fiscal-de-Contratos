import { Request, Response } from "express";
import { SetorService } from "./setor.service";
import { sendSuccess } from "../../common/middleware";
import { id } from "zod/v4/locales";

export class SetorController {
  constructor(private service: SetorService) { }

  // Criar novo setor
  async create(req: Request, res: Response): Promise<void> {
    const setor = await this.service.create(req.body);
    sendSuccess(res, setor, 201);
  }

  // Atualiza campos do setor
  async update(req: Request, res: Response): Promise<void> {
    const idSetor = Number(req.params.id)

    const setor = await this.service.update(idSetor, req.body)

    sendSuccess(res, setor)
  }

  // Buscar todos os setores
  async findAll(req: Request, res: Response): Promise<void> {
    const setores = await this.service.findAll();
    sendSuccess(res, setores);
  }

  // Encontrar setor por ID
  async findById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const setor = await this.service.findById(id);
    sendSuccess(res, setor);
  }

  // Deletar um usuário por id
  async delete(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id)
    const setor = await this.service.deleteById(id)
    sendSuccess(res, setor)
  }
}