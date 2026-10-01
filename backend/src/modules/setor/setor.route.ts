import { Router } from "express";
import { SetorController } from "./setor.controller";
import { SetorService } from "./setor.service";
import { SetorRepository } from "./setor.repository";
import { asyncHandler, autenticationMiddleware, requerAdmin, validateBody, validateParams } from "../../common/middleware";
import { CreateSetorSchema, IdParamSchema, UpdateSetorSchema } from "../../common/schemas";

// Injeção de dependência
const repository = new SetorRepository();
const service = new SetorService(repository);
const controller = new SetorController(service);

export const setorRouter = Router();

setorRouter.post(
  "/",
  autenticationMiddleware,
  requerAdmin,
  validateBody(CreateSetorSchema),
  asyncHandler((req, res) => controller.create(req, res))
);

setorRouter.patch(
  "/:id",
  autenticationMiddleware,
  requerAdmin,
  validateBody(UpdateSetorSchema),
  asyncHandler((req, res) => controller.update(req, res))
)

setorRouter.get(
  "/",
  autenticationMiddleware,
  asyncHandler((req, res) => controller.findAll(req, res))
);

setorRouter.get(
  "/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.findById(req, res))
);

setorRouter.delete(
  "/:id",
  autenticationMiddleware,
  requerAdmin,
  validateParams(IdParamSchema),
  asyncHandler((req,res) => controller.delete(req, res))
)