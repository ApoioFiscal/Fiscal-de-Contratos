import { Router } from "express";
import { LicitacaoController } from "./licitacao.controller";
import { LicitacaoService } from "./licitacao.service";
import { LicitacaoRepository } from "./licitacao.repository";
import { asyncHandler, autenticationMiddleware, validateBody, validateParams } from "../../common/middleware";
import { requerPerfil } from "../../common/perfil";
import { CreateLicitacaoSchema, IdParamSchema, UpdateLicitacaoSchema } from "../../common/schemas";

const repository = new LicitacaoRepository();
const service = new LicitacaoService(repository);
const controller = new LicitacaoController(service);

export const licitacaoRouter = Router();

// Cadastro de licitação/contrato (Secretaria de Licitações ou Gabinete)
licitacaoRouter.post(
  "/",
  autenticationMiddleware,
  requerPerfil("licitacoes", "gabinete"),
  validateBody(CreateLicitacaoSchema),
  asyncHandler((req, res) => controller.create(req, res))
);

// Atualização de licitação/contrato (Secretaria de Licitações ou Gabinete)
licitacaoRouter.patch(
  "/:id",
  autenticationMiddleware,
  requerPerfil("licitacoes", "gabinete"),
  validateParams(IdParamSchema),
  validateBody(UpdateLicitacaoSchema),
  asyncHandler((req, res) => controller.update(req, res))
);

// Listagem de licitações/contratos
licitacaoRouter.get(
  "/",
  autenticationMiddleware,
  asyncHandler((req, res) => controller.findAll(req, res))
);

// Geração do arquivo de contrato (Secretaria de Licitações ou Gabinete)
licitacaoRouter.post(
  "/:id/gerar-contrato",
  autenticationMiddleware,
  requerPerfil("licitacoes", "gabinete"),
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.gerarContrato(req, res))
);

// Download do arquivo de contrato gerado
licitacaoRouter.get(
  "/:id/arquivo",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.downloadContrato(req, res))
);

// Detalhe de uma licitação/contrato
licitacaoRouter.get(
  "/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.findById(req, res))
);