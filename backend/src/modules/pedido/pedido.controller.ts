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
    const pedido = await this.service.atualizarStatus(
      id,
      { id: req.user?.id as number, nome: req.user?.nome },
      req.body
    );
    sendSuccess(res, pedido);
  }

  async registrarAviso(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const pedido = await this.service.registrarAviso(
      id,
      { id: req.user?.id as number },
      req.body.mensagem
    );
    sendSuccess(res, pedido, 201);
  }

  async downloadTermoRecebimento(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const { caminho, filename } = await this.service.obterArquivoTermo(id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(caminho);
  }
}