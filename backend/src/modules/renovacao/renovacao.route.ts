import { Router } from "express";
import { TermoRenovacaoController } from "./renovacao.controller";
import { TermoRenovacaoService } from "./renovacao.service";
import { TermoRenovacaoRepository } from "./renovacao.repository";
import { asyncHandler, autenticationMiddleware, validateBody, validateParams } from "../../common/middleware";
import { requerPerfil } from "../../common/perfil";
import {
  AtualizarTermoRenovacaoSchema,
  CreateTermoRenovacaoSchema,
  IdParamSchema,
} from "../../common/schemas";

const repository = new TermoRenovacaoRepository();
const service = new TermoRenovacaoService(repository);
const controller = new TermoRenovacaoController(service);

export const termoRenovacaoRouter = Router();

// Qualquer secretaria beneficiária solicita termo de renovação para a Licitações
termoRenovacaoRouter.post(
  "/",
  autenticationMiddleware,
  validateBody(CreateTermoRenovacaoSchema),
  asyncHandler((req, res) => controller.emitir(req, res))
);

// Lista termos (filtra por status: ?status=)
termoRenovacaoRouter.get(
  "/",
  autenticationMiddleware,
  asyncHandler((req, res) => controller.listar(req, res))
);

// Detalhe de um termo
termoRenovacaoRouter.get(
  "/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.detalhe(req, res))
);

// LIC analisa e resolve/arquiva o termo
termoRenovacaoRouter.patch(
  "/:id",
  autenticationMiddleware,
  requerPerfil("licitacoes", "gabinete"),
  validateParams(IdParamSchema),
  validateBody(AtualizarTermoRenovacaoSchema),
  asyncHandler((req, res) => controller.alterarStatus(req, res))
);