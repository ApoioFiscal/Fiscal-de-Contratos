import { StatusPedido } from "@prisma/client";
import { prisma } from "../../prisma/client";
import { CreatePedidoInput, AtualizarStatusPedidoInput } from "../../common/schemas";

export interface PedidoItemEntrada {
  idItemLicitado: number;
  quantidade: number;
  valorUnitario: number;
}

type CriarPedidoData = Omit<CreatePedidoInput, "itens"> & {
  idUsuarioCriador: number;
  idSetorCriador: number;
};

const pedidoInclude = {
  itens: {
    include: {
      itemLicitado: {
        select: {
          id: true,
          descricao: true,
          marca: true,
          unidade: true,
          quantidade: true,
          precoUnitario: true,
        },
      },
    },
  },
  contrato: {
    select: {
      id: true,
      numero: true,
      numeroProcesso: true,
      fornecedor: true,
      cnpjFornecedor: true,
    },
  },
  setor: {
    select: { id: true, nome: true, sigla: true },
  },
  usuario: {
    select: { id: true, nome: true },
  },
  notasFiscais: {
    select: { id: true, numeroNota: true, dataEmissao: true, dataEntrada: true },
    orderBy: { dataEntrada: "desc" as const },
  },
};

export class PedidoRepository {
  async findContratoComSetoresEItens(id: number) {
    return prisma.licitacaoContrato.findUnique({
      where: { id },
      include: {
        setores: { select: { idSetor: true } },
        itens: {
          select: {
            id: true,
            descricao: true,
            unidade: true,
            quantidade: true,
            precoUnitario: true,
            consumido: true,
          },
        },
      },
    });
  }

  async somarComprometido(idItemLicitado: number): Promise<number> {
    const itens = await prisma.pedidoItem.findMany({
      where: {
        idItemLicitado,
        pedido: {
          status: { in: [StatusPedido.EM_COMPRA, StatusPedido.ENTREGUE] },
        },
      },
      select: { quantidade: true },
    });

    return itens.reduce((sum, item) => sum + item.quantidade, 0);
  }

  async countPedidos(): Promise<number> {
    return prisma.pedido.count();
  }

  async create(data: CriarPedidoData, itens: PedidoItemEntrada[], numeroPedido: string) {
    const valorTotal = itens.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0);

    return prisma.pedido.create({
      data: {
        numeroPedido,
        idUsuarioCriador: data.idUsuarioCriador,
        idSetorCriador: data.idSetorCriador,
        idContrato: data.idContrato,
        dataPrevistaEntrega: data.dataPrevistaEntrega ?? null,
        observacao: data.observacao ?? null,
        itens: {
          create: itens.map((item) => ({
            idItemLicitado: item.idItemLicitado,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorUnitario * item.quantidade,
          })),
        },
      },
      include: pedidoInclude,
    });
  }

  async findById(id: number) {
    return prisma.pedido.findUnique({
      where: { id },
      include: pedidoInclude,
    });
  }

  async findAll() {
    return prisma.pedido.findMany({
      include: pedidoInclude,
      orderBy: { dataPedido: "desc" },
    });
  }

  async findBySetor(idSetor: number) {
    return prisma.pedido.findMany({
      where: { idSetorCriador: idSetor },
      include: pedidoInclude,
      orderBy: { dataPedido: "desc" },
    });
  }

  async updateStatus(id: number, status: StatusPedido, input: AtualizarStatusPedidoInput) {
    const data: Record<string, unknown> = { status };

    if (status === StatusPedido.EM_COMPRA) {
      data.numeroOrdem = input.numeroOrdem ?? null;
      data.dataOrdem = new Date();
      data.dataPrevistaEntrega = input.dataPrevistaEntrega ?? undefined;
    }

    if ("dataPrevistaEntrega" in data && data.dataPrevistaEntrega === undefined) {
      delete data.dataPrevistaEntrega;
    }

    return prisma.pedido.update({
      where: { id },
      data,
      include: pedidoInclude,
    });
  }
}