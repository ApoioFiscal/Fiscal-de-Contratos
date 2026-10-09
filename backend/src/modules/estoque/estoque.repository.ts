import { StatusPedido, TipoMovimentacao } from "@prisma/client";
import { prisma } from "../../prisma/client";
import { CreateBaixaInput, CreateNotaFiscalInput, EstoqueQuery } from "../../common/schemas";
import { DuplicateDataError, NotFoundError, ValidationError } from "../../common/errors";

export interface EntradaNotaParams {
  idPedido: number;
  numeroNota: string;
  dataEmissao: Date;
  observacao?: string;
  itens: CreateNotaFiscalInput["itens"];
}

export class EstoqueRepository {
  async contratoExiste(id: number): Promise<boolean> {
    const contrato = await prisma.licitacaoContrato.findUnique({
      where: { id },
      select: { id: true },
    });
    return Boolean(contrato);
  }

  async entradaNota(params: EntradaNotaParams) {
    return prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: params.idPedido },
        include: {
          itens: { select: { idItemLicitado: true, quantidade: true, valorUnitario: true } },
          contrato: { select: { id: true, numero: true } },
        },
      });

      if (!pedido) {
        throw new NotFoundError("Pedido");
      }

      const duplicada = await tx.notaFiscal.findFirst({
        where: { numeroNota: params.numeroNota, idContrato: pedido.idContrato },
        select: { id: true },
      });

      if (duplicada) {
        throw new DuplicateDataError(`Nota fiscal ${params.numeroNota}`);
      }

      const erros: Record<string, string> = {};
      const porItem = new Map<number, { quantidade: number; valorUnitario: number }>();

      for (const linha of params.itens) {
        const linhaPedido = pedido.itens.find((i) => i.idItemLicitado === linha.idItemLicitado);

        if (!linhaPedido) {
          erros[`itens.${linha.idItemLicitado}`] = "Item não consta neste pedido";
          continue;
        }

        // A quantidade recebida pode exceder a quantidade pedida (empresa pode
        // entregar a mais). O valor recebido entra no estoque e fica registrado
        // na movimentação; a baixa automática na conclusão consome o pedido.
        porItem.set(linha.idItemLicitado, {
          quantidade: (porItem.get(linha.idItemLicitado)?.quantidade ?? 0) + linha.quantidade,
          valorUnitario: linha.valorUnitario ?? linhaPedido.valorUnitario,
        });
      }

      if (Object.keys(erros).length > 0) {
        throw new ValidationError("Nota fiscal não pode ser registrada", erros);
      }

      const nota = await tx.notaFiscal.create({
        data: {
          idPedido: pedido.id,
          idContrato: pedido.idContrato,
          numeroNota: params.numeroNota,
          dataEmissao: params.dataEmissao,
          observacao: params.observacao ?? null,
          itens: {
            create: params.itens.map((linha) => {
              const linhaPedido = pedido.itens.find((i) => i.idItemLicitado === linha.idItemLicitado)!;
              return {
                idItemLicitado: linha.idItemLicitado,
                quantidade: linha.quantidade,
                valorUnitario: linha.valorUnitario ?? linhaPedido.valorUnitario,
              };
            }),
          },
          movimentacoes: {
            create: params.itens.map((linha) => ({
              tipo: TipoMovimentacao.ENTRADA,
              idItemLicitado: linha.idItemLicitado,
              idPedido: pedido.id,
              quantidade: linha.quantidade,
              observacao: `Entrada por NF ${params.numeroNota}`,
            })),
          },
        },
        include: {
          itens: {
            include: {
              itemLicitado: { select: { id: true, descricao: true, unidade: true } },
            },
          },
          movimentacoes: true,
          pedido: { select: { id: true, numeroPedido: true, status: true } },
          contrato: { select: { id: true, numero: true } },
        },
      });

      for (const [itemId, agregado] of porItem) {
        await tx.itemLicitado.update({
          where: { id: itemId },
          data: { recebido: { increment: agregado.quantidade } },
        });
      }

      if (
        pedido.status === StatusPedido.PENDENTE ||
        pedido.status === StatusPedido.CONFIRMADO ||
        pedido.status === StatusPedido.EFETUADO
      ) {
        await tx.pedido.update({
          where: { id: pedido.id },
          data: { status: StatusPedido.EFETUADO },
        });
      }

      return nota;
    });
  }

  async baixa(input: CreateBaixaInput) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.itemLicitado.findUnique({ where: { id: input.idItemLicitado } });

      if (!item) {
        throw new NotFoundError("Item licitado");
      }

      const disponivelFisico = item.recebido - item.consumido;

      if (input.quantidade > disponivelFisico) {
        throw new ValidationError(`Estoque disponível insuficiente (${disponivelFisico} ${item.unidade})`);
      }

      await tx.itemLicitado.update({
        where: { id: item.id },
        data: { consumido: { increment: input.quantidade } },
      });

      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          tipo: TipoMovimentacao.BAIXA,
          idItemLicitado: item.id,
          idPedido: input.idPedido ?? null,
          quantidade: input.quantidade,
          observacao: input.observacao ?? "Baixa por consumo",
        },
        include: {
          itemLicitado: { select: { id: true, descricao: true, unidade: true } },
        },
      });

      return movimentacao;
    });
  }

  async listarMovimentacoes(query: EstoqueQuery) {
    const where: Record<string, unknown> = {};

    if (query.itemLicitadoId) {
      where.idItemLicitado = query.itemLicitadoId;
    }

    if (query.contratoId) {
      where.itemLicitado = { idLicitacao: query.contratoId };
    }

    return prisma.movimentacaoEstoque.findMany({
      where,
      include: {
        itemLicitado: {
          select: { id: true, descricao: true, unidade: true, idLicitacao: true },
        },
        pedido: { select: { id: true, numeroPedido: true } },
        notaFiscal: { select: { id: true, numeroNota: true } },
      },
      orderBy: { data: "desc" },
    });
  }

  async resumoContrato(idContrato: number) {
    return prisma.itemLicitado.findMany({
      where: { idLicitacao: idContrato },
      select: {
        id: true,
        descricao: true,
        marca: true,
        unidade: true,
        quantidade: true,
        precoUnitario: true,
        recebido: true,
        consumido: true,
      },
      orderBy: { id: "asc" },
    });
  }
}