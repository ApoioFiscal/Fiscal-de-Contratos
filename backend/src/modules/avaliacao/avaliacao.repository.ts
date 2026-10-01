import { prisma } from "../../prisma/client";
import { CreateAvaliacaoInput } from "../../common/schemas";

export class AvaliacaoRepository {
  async pedidoComContrato(id: number) {
    return prisma.pedido.findUnique({
      where: { id },
      select: { id: true, idContrato: true, numeroPedido: true },
    });
  }

  async create(data: CreateAvaliacaoInput & { idUsuarioFiscal: number; idContrato: number }) {
    return prisma.avaliacao.create({
      data: {
        idPedido: data.idPedido,
        idContrato: data.idContrato,
        idUsuarioFiscal: data.idUsuarioFiscal,
        notaEntrega: data.notaEntrega,
        notaPrazo: data.notaPrazo,
        possuiProblema: data.possuiProblema,
        descricaoProblema: data.descricaoProblema ?? null,
        observacao: data.observacao ?? null,
      },
      include: {
        pedido: { select: { numeroPedido: true, status: true } },
        contrato: { select: { id: true, numero: true, fornecedor: true } },
        usuarioFiscal: { select: { nome: true } },
      },
    });
  }

  async findByContrato(idContrato?: number) {
    return prisma.avaliacao.findMany({
      where: idContrato ? { idContrato } : undefined,
      include: {
        pedido: { select: { numeroPedido: true, status: true } },
        contrato: { select: { id: true, numero: true, fornecedor: true } },
        usuarioFiscal: { select: { nome: true } },
      },
      orderBy: { dataAvaliacao: "desc" },
    });
  }

  async agregadosFornecedor(idContrato: number) {
    return prisma.avaliacao.findMany({
      where: { idContrato },
      select: {
        id: true,
        idPedido: true,
        notaEntrega: true,
        notaPrazo: true,
        possuiProblema: true,
        descricaoProblema: true,
        pedido: { select: { numeroPedido: true } },
      },
      orderBy: { dataAvaliacao: "desc" },
    });
  }
}