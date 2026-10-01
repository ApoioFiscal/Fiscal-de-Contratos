import { Router } from "express";
import { EstoqueController } from "./estoque.controller";
import { EstoqueService } from "./estoque.service";
import { EstoqueRepository } from "./estoque.repository";
import { asyncHandler, autenticationMiddleware, validateBody, validateParams } from "../../common/middleware";
import { requerPerfil } from "../../common/perfil";
import { CreateBaixaSchema, CreateNotaFiscalSchema, IdParamSchema } from "../../common/schemas";

const repository = new EstoqueRepository();
const service = new EstoqueService(repository);
const controller = new EstoqueController(service);

export const estoqueRouter = Router();

// Entrada de nota fiscal (FCON/Gabinete) — gera movimentação de ENTRADA e atualiza status
estoqueRouter.post(
  "/",
  autenticationMiddleware,
  requerPerfil("contratos", "fiscal", "gabinete"),
  validateBody(CreateNotaFiscalSchema),
  asyncHandler((req, res) => controller.entradaNota(req, res))
);

// Baixa por consumo (FCON/Gabinete)
estoqueRouter.post(
  "/baixas",
  autenticationMiddleware,
  requerPerfil("contratos", "fiscal", "gabinete"),
  validateBody(CreateBaixaSchema),
  asyncHandler((req, res) => controller.baixa(req, res))
);

// Lista movimentações (filtra por item ou contrato)
estoqueRouter.get(
  "/",
  autenticationMiddleware,
  asyncHandler((req, res) => controller.listar(req, res))
);

// Saldos por item de um contrato
estoqueRouter.get(
  "/contrato/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.resumoContrato(req, res))
);