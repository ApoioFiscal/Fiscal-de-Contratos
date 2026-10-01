import { EstoqueRepository } from "./estoque.repository";
import { CreateBaixaInput, CreateNotaFiscalInput, EstoqueQuery } from "../../common/schemas";
import { NotFoundError } from "../../common/errors";

export class EstoqueService {
  constructor(private repository: EstoqueRepository) {}

  async entradaNota(input: CreateNotaFiscalInput) {
    return this.repository.entradaNota({
      idPedido: input.idPedido,
      numeroNota: input.numeroNota,
      dataEmissao: input.dataEmissao,
      observacao: input.observacao,
      itens: input.itens,
    });
  }

  async baixa(input: CreateBaixaInput) {
    return this.repository.baixa(input);
  }

  async listarMovimentacoes(query: EstoqueQuery) {
    return this.repository.listarMovimentacoes(query);
  }

  async resumoContrato(idContrato: number) {
    const existe = await this.repository.contratoExiste(idContrato);

    if (!existe) {
      throw new NotFoundError("Contrato");
    }

    return this.repository.resumoContrato(idContrato);
  }
}