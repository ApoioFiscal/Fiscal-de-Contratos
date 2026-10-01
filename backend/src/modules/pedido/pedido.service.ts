import { StatusPedido } from "@prisma/client";
import { PedidoRepository } from "./pedido.repository";
import { CreatePedidoInput, AtualizarStatusPedidoInput } from "../../common/schemas";
import { ForbiddenError, NotFoundError, ValidationError } from "../../common/errors";

interface UsuarioAutenticado {
  id: number;
  idSetor?: number;
  isAdmin?: boolean;
}

export class PedidoService {
  constructor(private repository: PedidoRepository) {}

  private gerarNumeroPedido(quantidade: number): string {
    const proximo = quantidade + 1;
    return `REQ-${String(proximo).padStart(3, "0")}`;
  }

  private validarBeneficiaria(contrato: { setores: { idSetor: number }[] }, user: UsuarioAutenticado) {
    if (user.isAdmin) {
      return;
    }

    const eBeneficiaria = contrato.setores.some((s) => s.idSetor === user.idSetor);
    if (!eBeneficiaria) {
      throw new ForbiddenError("Seu setor não é beneficiário deste contrato");
    }
  }

  async create(user: UsuarioAutenticado, input: CreatePedidoInput) {
    const contrato = await this.repository.findContratoComSetoresEItens(input.idContrato);
    if (!contrato) {
      throw new NotFoundError("Contrato");
    }

    this.validarBeneficiaria(contrato, user);

    if (!user.idSetor) {
      throw new ValidationError("Usuário sem setor vinculado");
    }

    const itensDoPedido: { idItemLicitado: number; quantidade: number; valorUnitario: number }[] = [];
    const erros: Record<string, string> = {};

    for (const itemInput of input.itens) {
      const itemContrato = contrato.itens.find((item) => item.id === itemInput.idItemLicitado);

      if (!itemContrato) {
        erros[`itens.${itemInput.idItemLicitado}`] = "Item não pertence a este contrato";
        continue;
      }

      const comprometido = await this.repository.somarComprometido(itemInput.idItemLicitado);
      const disponivel = itemContrato.quantidade - itemContrato.consumido - comprometido;

      if (itemInput.quantidade > disponivel) {
        erros[`itens.${itemInput.idItemLicitado}`] =
          `Quantidade (${itemInput.quantidade}) excede o saldo disponível do item (${disponivel} ${itemContrato.unidade})`;
        continue;
      }

      itensDoPedido.push({
        idItemLicitado: itemInput.idItemLicitado,
        quantidade: itemInput.quantidade,
        valorUnitario: itemContrato.precoUnitario,
      });
    }

    if (itensDoPedido.length === 0 || Object.keys(erros).length > 0) {
      throw new ValidationError("Pedido não pode ser registrado", erros);
    }

    const totalPedidos = await this.repository.countPedidos();
    const numeroPedido = this.gerarNumeroPedido(totalPedidos);

    return this.repository.create(
      {
        idContrato: input.idContrato,
        idUsuarioCriador: user.id,
        idSetorCriador: user.idSetor,
        dataPrevistaEntrega: input.dataPrevistaEntrega,
        observacao: input.observacao,
      },
      itensDoPedido,
      numeroPedido
    );
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findBySetor(idSetor: number) {
    return this.repository.findBySetor(idSetor);
  }

  async findById(id: number) {
    const pedido = await this.repository.findById(id);
    if (!pedido) {
      throw new NotFoundError("Pedido");
    }
    return pedido;
  }

  async atualizarStatus(id: number, input: AtualizarStatusPedidoInput) {
    const pedido = await this.repository.findById(id);
    if (!pedido) {
      throw new NotFoundError("Pedido");
    }

    if (input.status === StatusPedido.EM_COMPRA && !input.numeroOrdem) {
      throw new ValidationError("Informe o número da ordem de compra");
    }

    return this.repository.updateStatus(id, input.status, input);
  }
}