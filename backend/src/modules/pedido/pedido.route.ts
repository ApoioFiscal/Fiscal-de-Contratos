import { Router } from "express";
import { PedidoController } from "./pedido.controller";
import { PedidoService } from "./pedido.service";
import { PedidoRepository } from "./pedido.repository";
import { asyncHandler, autenticationMiddleware, validateBody, validateParams } from "../../common/middleware";
import { requerPerfil } from "../../common/perfil";
import { AtualizarStatusPedidoSchema, CreatePedidoSchema, IdParamSchema } from "../../common/schemas";

const repository = new PedidoRepository();
const service = new PedidoService(repository);
const controller = new PedidoController(service);

export const pedidoRouter = Router();

// Criação de pedido (qualquer secretaria beneficiária, ou gabinete)
pedidoRouter.post(
  "/",
  autenticationMiddleware,
  validateBody(CreatePedidoSchema),
  asyncHandler((req, res) => controller.create(req, res))
);

// Pedidos do setor do usuário autenticado ("Meus Pedidos")
pedidoRouter.get(
  "/meus",
  autenticationMiddleware,
  asyncHandler((req, res) => controller.findMeus(req, res))
);

// Fila de pedidos (apenas a Fiscalização de Contratos)
pedidoRouter.get(
  "/fila",
  autenticationMiddleware,
  requerPerfil("contratos", "fiscal"),
  asyncHandler((req, res) => controller.findAll(req, res))
);

// Detalhe de um pedido
pedidoRouter.get(
  "/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.findById(req, res))
);

// Transição de status do pedido (apenas Fiscalização de Contratos)
pedidoRouter.patch(
  "/:id/status",
  autenticationMiddleware,
  requerPerfil("contratos", "fiscal"),
  validateParams(IdParamSchema),
  validateBody(AtualizarStatusPedidoSchema),
  asyncHandler((req, res) => controller.atualizarStatus(req, res))
);