import { AvaliacaoRepository } from "./avaliacao.repository";
import { CreateAvaliacaoInput } from "../../common/schemas";
import { NotFoundError } from "../../common/errors";

export interface UsuarioAvaliador {
  id: number;
}

export class AvaliacaoService {
  constructor(private repository: AvaliacaoRepository) {}

  async create(user: UsuarioAvaliador, input: CreateAvaliacaoInput) {
    const pedido = await this.repository.pedidoComContrato(input.idPedido);

    if (!pedido) {
      throw new NotFoundError("Pedido");
    }

    return this.repository.create({
      idPedido: input.idPedido,
      idContrato: pedido.idContrato,
      idUsuarioFiscal: user.id,
      notaEntrega: input.notaEntrega,
      notaPrazo: input.notaPrazo,
      possuiProblema: input.possuiProblema,
      descricaoProblema: input.descricaoProblema,
      observacao: input.observacao,
    });
  }

  async listar(idContrato?: number) {
    return this.repository.findByContrato(idContrato);
  }

  async resumoFornecedor(idContrato: number) {
    const avaliacoes = await this.repository.agregadosFornecedor(idContrato);

    if (avaliacoes.length === 0) {
      return {
        idContrato,
        totalAvaliacoes: 0,
        mediaNotaEntrega: null,
        mediaNotaPrazo: null,
        entregasComProblema: 0,
        problemas: [],
      };
    }

    const somaEntrega = avaliacoes.reduce((sum, a) => sum + a.notaEntrega, 0);
    const somaPrazo = avaliacoes.reduce((sum, a) => sum + a.notaPrazo, 0);

    return {
      idContrato,
      totalAvaliacoes: avaliacoes.length,
      mediaNotaEntrega: Number((somaEntrega / avaliacoes.length).toFixed(2)),
      mediaNotaPrazo: Number((somaPrazo / avaliacoes.length).toFixed(2)),
      entregasComProblema: avaliacoes.filter((a) => a.possuiProblema).length,
      problemas: avaliacoes
        .filter((a) => a.possuiProblema && a.descricaoProblema)
        .map((a) => ({
          idAvaliacao: a.id,
          numeroPedido: a.pedido.numeroPedido,
          descricao: a.descricaoProblema,
        })),
    };
  }
}