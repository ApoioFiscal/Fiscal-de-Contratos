import { Router } from "express";
import { AvaliacaoController } from "./avaliacao.controller";
import { AvaliacaoService } from "./avaliacao.service";
import { AvaliacaoRepository } from "./avaliacao.repository";
import { asyncHandler, autenticationMiddleware, validateBody, validateParams } from "../../common/middleware";
import { requerPerfil } from "../../common/perfil";
import { CreateAvaliacaoSchema, IdParamSchema } from "../../common/schemas";

const repository = new AvaliacaoRepository();
const service = new AvaliacaoService(repository);
const controller = new AvaliacaoController(service);

export const avaliacaoRouter = Router();

// Registro de avaliação de entrega/fornecedor (FCON/Gabinete)
avaliacaoRouter.post(
  "/",
  autenticationMiddleware,
  requerPerfil("contratos", "fiscal", "gabinete"),
  validateBody(CreateAvaliacaoSchema),
  asyncHandler((req, res) => controller.create(req, res))
);

// Lista avaliações (filtra por contrato: ?contratoId=)
avaliacaoRouter.get(
  "/",
  autenticationMiddleware,
  asyncHandler((req, res) => controller.listar(req, res))
);

// Resumo/agregados do fornecedor de um contrato
avaliacaoRouter.get(
  "/resumo/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.resumoFornecedor(req, res))
);