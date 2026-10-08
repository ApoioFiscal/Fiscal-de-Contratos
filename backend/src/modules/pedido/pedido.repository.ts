import { Prisma, StatusPedido, TipoHistoricoPedido, TipoMovimentacao } from "@prisma/client";
import { prisma } from "../../prisma/client";
import { CreatePedidoInput, AtualizarStatusPedidoInput } from "../../common/schemas";
import { NotFoundError } from "../../common/errors";

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
      objeto: true,
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
  historico: {
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: { data: "asc" as const },
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
          status: {
            in: [
              StatusPedido.PENDENTE,
              StatusPedido.CONFIRMADO,
              StatusPedido.EFETUADO,
              StatusPedido.ENTREGUE,
              StatusPedido.CONFERENCIA,
            ],
          },
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
        dataPrevistaEntrega: data.dataPrevistaEntrega,
        observacao: data.observacao ?? null,
        itens: {
          create: itens.map((item) => ({
            idItemLicitado: item.idItemLicitado,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorUnitario * item.quantidade,
          })),
        },
        historico: {
          create: {
            tipo: TipoHistoricoPedido.CRIACAO,
            idUsuario: data.idUsuarioCriador,
            mensagem: `Pedido criado pela ${data.idSetorCriador ? "secretaria solicitante" : "secretaria"}`,
          },
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

  async updateStatus(id: number, status: StatusPedido, input: AtualizarStatusPedidoInput, idUsuario: number) {
    return prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id },
        include: {
          itens: { select: { idItemLicitado: true, quantidade: true } },
        },
      });

      if (!pedido) {
        throw new NotFoundError("Pedido");
      }

      const data: Prisma.PedidoUncheckedUpdateInput = { status };

      if (status === StatusPedido.CONFIRMADO) {
        data.numeroOrdem = input.numeroOrdem ?? null;
        data.dataOrdem = new Date();
      }

      const atualizado = await tx.pedido.update({ where: { id }, data });

      await tx.pedidoHistorico.create({
        data: {
          idPedido: id,
          tipo: TipoHistoricoPedido.STATUS,
          status,
          idUsuario,
          mensagem:
            status === StatusPedido.CONFIRMADO
              ? `Compra registrada (ordem ${input.numeroOrdem ?? "—"})`
              : undefined,
        },
      });

      if (input.aviso) {
        await tx.pedidoHistorico.create({
          data: {
            idPedido: id,
            tipo: TipoHistoricoPedido.AVISO,
            idUsuario,
            mensagem: input.aviso,
          },
        });
      }

      if (status === StatusPedido.CONCLUIDO) {
        for (const item of pedido.itens) {
          await tx.itemLicitado.update({
            where: { id: item.idItemLicitado },
            data: { consumido: { increment: item.quantidade } },
          });

          await tx.movimentacaoEstoque.create({
            data: {
              tipo: TipoMovimentacao.BAIXA,
              idItemLicitado: item.idItemLicitado,
              idPedido: id,
              quantidade: item.quantidade,
              observacao: "Baixa automática na conclusão do pedido",
            },
          });
        }
      }

      return atualizado;
    }).then(() => this.findById(id));
  }

  async registrarAviso(id: number, idUsuario: number, mensagem: string) {
    await prisma.pedidoHistorico.create({
      data: {
        idPedido: id,
        tipo: TipoHistoricoPedido.AVISO,
        idUsuario,
        mensagem,
      },
    });

    return this.findById(id);
  }
}