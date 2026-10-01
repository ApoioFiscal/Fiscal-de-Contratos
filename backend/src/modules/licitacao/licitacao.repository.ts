import { prisma } from "../../prisma/client";
import { StatusContrato } from "@prisma/client";
import { CreateLicitacaoInput, UpdateLicitacaoInput } from "../../common/schemas";

const licitacaoInclude = {
  itens: {
    orderBy: { id: "asc" as const },
  },
  setores: {
    include: {
      setor: {
        select: { id: true, nome: true, sigla: true },
      },
    },
  },
};

export class LicitacaoRepository {
  async create(input: CreateLicitacaoInput, valorTotal: number) {
    const { idSetores, itens, ...rest } = input;

    return prisma.licitacaoContrato.create({
      data: {
        ...rest,
        valorTotal,
        itens: {
          create: itens.map((item) => ({
            ...item,
            precoTotal: item.precoUnitario * item.quantidade,
          })),
        },
        setores: {
          create: idSetores.map((idSetor) => ({ idSetor })),
        },
      },
      include: licitacaoInclude,
    });
  }

  async findByNumero(numero: string) {
    return prisma.licitacaoContrato.findUnique({ where: { numero } });
  }

  async findById(id: number) {
    return prisma.licitacaoContrato.findUnique({
      where: { id },
      include: licitacaoInclude,
    });
  }

  async findAll() {
    return prisma.licitacaoContrato.findMany({
      include: licitacaoInclude,
      orderBy: { dataAbertura: "desc" },
    });
  }

  async update(id: number, input: UpdateLicitacaoInput) {
    const { idSetores, itens, ...rest } = input;

    const data: Record<string, unknown> = { ...rest };

    if (itens) {
      data.itens = {
        deleteMany: {},
        create: itens.map((item) => ({
          ...item,
          precoTotal: item.precoUnitario * item.quantidade,
        })),
      };
    }

    if (idSetores) {
      data.setores = {
        deleteMany: {},
        create: idSetores.map((idSetor) => ({ idSetor })),
      };
    }

    if (itens || rest) {
      data.valorTotal = itens
        ? itens.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0)
        : undefined;
    }

    if (data.valorTotal === undefined) {
      delete data.valorTotal;
    }

    return prisma.licitacaoContrato.update({
      where: { id },
      data,
      include: licitacaoInclude,
    });
  }

  async marcarContratoGerado(id: number, filename: string) {
    return prisma.licitacaoContrato.update({
      where: { id },
      data: {
        arquivoContrato: filename,
        dataGeracaoContrato: new Date(),
        status: StatusContrato.ATIVA,
      },
      include: licitacaoInclude,
    });
  }
}