import bcrypt from "bcrypt";
import { UsuarioRepository } from "./usuario.repository";
import { SetorRepository } from "../setor/setor.repository";
import { CreateUsuarioInput, LoginUserInput } from "../../common/schemas";
import { DuplicateEmailError, NotFoundError, ValidationError } from "../../common/errors";
import jwt from "jsonwebtoken"

const SALT_ROUNDS = 12;

export class UsuarioService {
  constructor(
    private usuarioRepository: UsuarioRepository,
    private setorRepository: SetorRepository
  ) { }

  // Criação de um novo usuário
  async create(input: CreateUsuarioInput) {
    // Valida email único
    const emailJaExiste = await this.usuarioRepository.findByEmail(input.email);
    if (emailJaExiste) {
      throw new DuplicateEmailError();
    }

    // Valida setor existente
    const setorExiste = await this.setorRepository.findById(input.idSetor);
    if (!setorExiste) {
      throw new NotFoundError("Setor");
    }

    // Criptografa a senha
    const senhaHash = await bcrypt.hash(input.senha, SALT_ROUNDS);

    return this.usuarioRepository.create({
      ...input,
      senha: senhaHash,
    });
  }

  // Busca todos os usuários.
  async findAll() {
    return this.usuarioRepository.findAll();
  }

  // Encontra um usuário pelo ID
  async findById(id: number) {
    const usuario = await this.usuarioRepository.findById(id);
    // Retorna erro caso o usuário não exista
    if (!usuario) {
      throw new NotFoundError("Usuário");
    }

    return usuario;
  }

  // Deleta um usuário pelo ID
  async deleteById(id: number) {
    const usuario = await this.usuarioRepository.findById(id)
    // Retorna erro caso o usuário não exista
    if (!usuario) {
      throw new NotFoundError("Usuário")
    }

    // Deleta o usuário pelo Id
    return this.usuarioRepository.deleteById(id)
  }

  // Rota de login para o usuário
  async loginUser(input: LoginUserInput): Promise<string> {
    // Verifica se o usuário existe
    const usuario = await this.usuarioRepository.findByEmail(input.email);
    if (!usuario) {
      throw new ValidationError("Usuário não encontrado");
    }

    // Verifica se a senha está certa
    const senhaValida = await bcrypt.compare(
      input.senha,
      usuario.senha
    )

    if (!senhaValida) {
      throw new ValidationError("Credenciais inválidas");
    }

    // Gera o token pra o usuário
    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email, 
        funcao: usuario.funcao, 
        isAdmin: usuario.isAdmin,
        idSetor: usuario.idSetor,
        setor: usuario.setor,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1d"
      }
    )

    return token
  }
}
