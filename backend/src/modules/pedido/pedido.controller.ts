import { Request, Response } from "express";
import { PedidoService } from "./pedido.service";
import { sendSuccess } from "../../common/middleware";

export class PedidoController {
  constructor(private service: PedidoService) {}

  async create(req: Request, res: Response): Promise<void> {
    const usuario = {
      id: req.user?.id as number,
      idSetor: req.user?.idSetor,
      isAdmin: req.user?.isAdmin,
    };

    const pedido = await this.service.create(usuario, req.body);
    sendSuccess(res, pedido, 201);
  }

  async findAll(req: Request, res: Response): Promise<void> {
    const pedidos = await this.service.findAll();
    sendSuccess(res, pedidos);
  }

  async findMeus(req: Request, res: Response): Promise<void> {
    const pedidos = await this.service.findBySetor(req.user?.idSetor as number);
    sendSuccess(res, pedidos);
  }

  async findById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const pedido = await this.service.findById(id);
    sendSuccess(res, pedido);
  }

  async atualizarStatus(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const pedido = await this.service.atualizarStatus(id, req.body);
    sendSuccess(res, pedido);
  }
}