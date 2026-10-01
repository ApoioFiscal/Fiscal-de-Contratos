import { Request, Response } from "express";
import { UsuarioService } from "./usuario.service";
import { sendSuccess } from "../../common/middleware";

export class UsuarioController {
  constructor(private service: UsuarioService) { }

  //  Criar um novo usuário
  async create(req: Request, res: Response): Promise<void> {
    const usuario = await this.service.create(req.body);
    sendSuccess(res, usuario, 201);
  }

  // Listar todos os setores
  async findAll(req: Request, res: Response): Promise<void> {
    const usuarios = await this.service.findAll();
    sendSuccess(res, usuarios);
  }

  // Encontrar um usuário por ID
  async findById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const usuario = await this.service.findById(id);
    sendSuccess(res, usuario);
  }

  // Deletar usuário por ID
  async deleteById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const usuario = await this.service.deleteById(id)
    sendSuccess(res, usuario)
  }

  // Login do usuário retornando o token
  async loginUser(req: Request, res: Response): Promise<void> {
    const token = await this.service.loginUser(req.body);
    sendSuccess(res, token);
  }
}