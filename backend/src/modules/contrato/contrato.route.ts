import { Router } from "express";
import express from "express";
import { ContratoController } from "./contrato.controller";
import { ContratoService } from "./contrato.service";
import { ContratoRepository } from "./contrato.repository";
import { ParsingClient } from "./parsingClient";
import { asyncHandler, autenticationMiddleware, validateParams } from "../../common/middleware";
import { requerPerfil } from "../../common/perfil";
import { IdParamSchema } from "../../common/schemas";

const repository = new ContratoRepository();
const parsing = new ParsingClient();
const service = new ContratoService(repository, parsing);
const controller = new ContratoController(service);

export const contratoRouter = Router();

// Importa um PDF assinado: o backend faz o proxy para o parsing, valida com o Zod
// (schema canônico do contrato real) e persiste no schema `contrato`.
contratoRouter.post(
  "/importar",
  autenticationMiddleware,
  requerPerfil("licitacoes", "gabinete"),
  express.raw({ type: "application/pdf", limit: "20mb" }),
  asyncHandler(async (req, res) => controller.importar(req, res)),
);
contratoRouter.get("/", autenticationMiddleware, asyncHandler(async (req, res) => controller.listar(req, res)));

contratoRouter.get(
  "/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler(async (req, res) => controller.obter(req, res)),
);

contratoRouter.patch(
  "/:id",
  autenticationMiddleware,
  requerPerfil("licitacoes", "gabinete"),
  validateParams(IdParamSchema),
  asyncHandler(async (req, res) => controller.atualizar(req, res)),
);

contratoRouter.get(
  "/:id/arquivo",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler(async (req, res) => controller.download(req, res)),
);
