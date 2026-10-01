import path from "path";
import { existsSync } from "fs";
import { LicitacaoRepository } from "./licitacao.repository";
import { CreateLicitacaoInput, UpdateLicitacaoInput } from "../../common/schemas";
import { DuplicateDataError, NotFoundError } from "../../common/errors";
import { GeradorContrato, GeradorContratoDocx } from "./geradorContrato";

const CONTRATOS_DIR = path.join(process.cwd(), "uploads", "contratos");

export class LicitacaoService {
  constructor(private repository: LicitacaoRepository, private geradorContrato: GeradorContrato = new GeradorContratoDocx()) {}

  async create(input: CreateLicitacaoInput) {
    const numeroJaExiste = await this.repository.findByNumero(input.numero);
    if (numeroJaExiste) {
      throw new DuplicateDataError("Número do contrato");
    }

    const valorTotal = input.itens.reduce(
      (sum, item) => sum + item.precoUnitario * item.quantidade,
      0
    );

    return this.repository.create(input, valorTotal);
  }

  async update(id: number, input: UpdateLicitacaoInput) {
    const licitacao = await this.repository.findById(id);
    if (!licitacao) {
      throw new NotFoundError("Licitação");
    }

    if (input.numero && input.numero !== licitacao.numero) {
      const numeroJaExiste = await this.repository.findByNumero(input.numero);
      if (numeroJaExiste) {
        throw new DuplicateDataError("Número do contrato");
      }
    }

    return this.repository.update(id, input);
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    const licitacao = await this.repository.findById(id);
    if (!licitacao) {
      throw new NotFoundError("Licitação");
    }
    return licitacao;
  }

  async gerarContrato(id: number) {
    const licitacao = await this.repository.findById(id);
    if (!licitacao) {
      throw new NotFoundError("Licitação");
    }

    const filename = await this.geradorContrato.gerar(licitacao, CONTRATOS_DIR);
    return this.repository.marcarContratoGerado(id, filename);
  }

  async obterArquivoContrato(id: number) {
    const licitacao = await this.repository.findById(id);
    if (!licitacao || !licitacao.arquivoContrato) {
      throw new NotFoundError("Contrato");
    }

    const caminho = path.join(CONTRATOS_DIR, licitacao.arquivoContrato);
    if (!existsSync(caminho)) {
      throw new NotFoundError("Arquivo do contrato");
    }

    return { caminho, filename: licitacao.arquivoContrato };
  }
}