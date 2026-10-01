import { Router } from "express";
import { UsuarioController } from "./usuario.controller";
import { UsuarioService } from "./usuario.service";
import { UsuarioRepository } from "./usuario.repository";
import { SetorRepository } from "../setor/setor.repository";
import { asyncHandler, autenticationMiddleware, requerAdmin, validateBody, validateParams } from "../../common/middleware";
import { CreateUsuarioSchema, IdParamSchema, UsuarioLoginSchema } from "../../common/schemas";

// Injeção de dependência
const usuarioRepository = new UsuarioRepository();
const setorRepository = new SetorRepository();
const service = new UsuarioService(usuarioRepository, setorRepository);
const controller = new UsuarioController(service);

export const usuarioRouter = Router();

// Rota para criar um novo usuário (apenas administrativo)
usuarioRouter.post(
  "/",
  autenticationMiddleware,
  requerAdmin,
  validateBody(CreateUsuarioSchema),
  asyncHandler((req, res) => controller.create(req, res))
);

// Rota de Login do usuário
usuarioRouter.post(
  "/login",
  validateBody(UsuarioLoginSchema),
  asyncHandler((req, res) => controller.loginUser(req, res))
)

// Rota para buscar todos os usuários
usuarioRouter.get(
  "/",
  autenticationMiddleware,
  asyncHandler((req, res) => controller.findAll(req, res))
);

// Rota para pegar um usuário por id
usuarioRouter.get(
  "/:id",
  autenticationMiddleware,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.findById(req, res))
);

// Rota para deletar um usuário (apenas administrativo)
usuarioRouter.delete(
  "/:id",
  autenticationMiddleware,
  requerAdmin,
  validateParams(IdParamSchema),
  asyncHandler((req, res) => controller.deleteById(req, res))
)