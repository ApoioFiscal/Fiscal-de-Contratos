import { Prisma, StatusTermoRenovacao } from "@prisma/client";
import { prisma } from "../../prisma/client";
import { CreateTermoRenovacaoInput } from "../../common/schemas";

const termoInclude = {
  contrato: {
    select: {
      id: true,
      numero: true,
      fornecedor: true,
      dataVigenciaFim: true,
      status: true,
    },
  },
  usuarioEmissor: { select: { id: true, nome: true } },
  usuarioLicitacao: { select: { id: true, nome: true } },
  setorSolicitante: { select: { id: true, nome: true, sigla: true } },
} as const;

export class TermoRenovacaoRepository {
  async findContratoComSetores(id: number) {
    return prisma.licitacaoContrato.findUnique({
      where: { id },
      select: {
        id: true,
        setores: { select: { idSetor: true } },
      },
    });
  }

  async create(data: CreateTermoRenovacaoInput & { idUsuarioEmissor: number; idSetorSolicitante: number | null }) {
    return prisma.termoRenovacao.create({
      data: {
        idContrato: data.idContrato,
        idUsuarioEmissor: data.idUsuarioEmissor,
        idSetorSolicitante: data.idSetorSolicitante,
        tipo: data.tipo,
        justificativa: data.justificativa,
        novaVigenciaFim: data.novaVigenciaFim ?? null,
        percentualAcrescimo: data.percentualAcrescimo ?? null,
      },
      include: termoInclude,
    });
  }

  async findAll(status?: StatusTermoRenovacao) {
    return prisma.termoRenovacao.findMany({
      where: status ? { status } : undefined,
      include: termoInclude,
      orderBy: { dataEmissao: "desc" },
    });
  }

  async findById(id: number) {
    return prisma.termoRenovacao.findUnique({
      where: { id },
      include: termoInclude,
    });
  }

  async update(id: number, data: Prisma.TermoRenovacaoUpdateInput) {
    return prisma.termoRenovacao.update({
      where: { id },
      data,
      include: termoInclude,
    });
  }
}