import { FuncaoUsuario } from "@prisma/client";
import { prisma } from "../../prisma/client";
import { CreateUsuarioInput } from "../../common/schemas";

interface UsuarioComSetor {
  id: number;
  nome: string;
  email: string;
  funcao: FuncaoUsuario;
  isAdmin: boolean;
  criadoEm: Date;
  setor: {
    id: number;
    nome: string;
    sigla: string;
  };
}

export class UsuarioRepository {
  private usuarioSelect = {
    id: true,
    nome: true,
    email: true,
    funcao: true,
    isAdmin: true,
    criadoEm: true,
    setor: {
      select: {
        id: true,
        nome: true,
        sigla: true,
      },
    },
  };

  async create(data: CreateUsuarioInput & { senha: string }): Promise<UsuarioComSetor> {
    return prisma.usuario.create({
      data,
      select: this.usuarioSelect,
    }) as Promise<UsuarioComSetor>;
  }

  async findByEmail(email: string) {
    return prisma.usuario.findUnique({
      where: { email },
      include: {
        setor: {
          select: {
            id: true,
            nome: true,
            sigla: true,
          },
        },
      },
    });
  }

  async findById(id: number): Promise<UsuarioComSetor | null> {
    return prisma.usuario.findUnique({
      where: { id },
      select: this.usuarioSelect,
    }) as Promise<UsuarioComSetor | null>;
  }

  async findAll(): Promise<UsuarioComSetor[]> {
    return prisma.usuario.findMany({
      select: this.usuarioSelect,
      orderBy: { criadoEm: "desc" },
    }) as Promise<UsuarioComSetor[]>;
  }

  async deleteById(id: number): Promise<UsuarioComSetor | null> {
    return prisma.usuario.delete({
      where: { id },
      select: this.usuarioSelect,
    }) as Promise<UsuarioComSetor | null>
  }
}
