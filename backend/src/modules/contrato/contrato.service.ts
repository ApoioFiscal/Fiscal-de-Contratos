import { ContratoExtractionSchema, AtualizarContratoSchema, AtualizarContratoInput } from "../../common/contrato.schema";
import { ContratoRepository } from "./contrato.repository";
import { ParsingClient } from "./parsingClient";
import { mapearParaCriar, ContratoCreateData } from "./conversorContrato";
import { NotFoundError, ValidationError, DuplicateContratoError, ContratoNaoExcluivelError } from "../../common/errors";

export type ContratoResposta = {
  id: number;
  numero: string;
  status: string;
  avisos: string[];
};

export class ContratoService {
  private readonly repository: ContratoRepository;
  private readonly parsing: ParsingClient;

  constructor(repository: ContratoRepository, parsing: ParsingClient) {
    this.repository = repository;
    this.parsing = parsing;
  }

  /**
   * Importa um PDF assinado: backend → parsing → Zod → persistência no schema `contrato`.
   * O status nasce `RASCUNHO` ("importado, aguardando revisão").
   */
  async importarArquivo(buffer: Buffer, nomeOriginal: string): Promise<ContratoResposta> {
    const { contrato, avisos } = await this.parsing.importarDocumento({ buffer, nomeOriginal });

    const dados = ContratoExtractionSchema.parse(contrato);
    const createData = mapearParaCriar(dados);

    // `numero` é único no banco: reimportar o mesmo PDF precisa devolver 409
    // (com instrução de exclusão) em vez do 500 genérico do P2002.
    const numero = createData.numero.trim();
    if (numero) {
      const existente = await this.repository.findByNumero(numero);
      if (existente) throw new DuplicateContratoError(numero);
    }

    const contratoCriado = await this.repository.importar({
      data: createData,
      arquivoPdf: null,
      arquivoPdfNome: nomeOriginal,
    });

    return {
      id: contratoCriado.id,
      numero: contratoCriado.numero,
      status: contratoCriado.status as string,
      avisos,
    };
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    const contrato = await this.repository.findById(id);
    if (!contrato) throw new NotFoundError("Contrato");
    return contrato;
  }

  async findByNumero(numero: string) {
    return this.repository.findByNumero(numero);
  }

  async delete(id: number) {
    const contrato = await this.repository.findById(id);
    if (!contrato) throw new NotFoundError("Contrato");
    // Contrato confirmado/salvo é registro oficial: não pode ser excluído.
    // Só o rascunho (PDF importado e ainda não confirmado) pode ser descartado.
    if (contrato.status !== "RASCUNHO") throw new ContratoNaoExcluivelError();
    await this.repository.delete(id);
  }
  async atualizar(id: number, input: AtualizarContratoInput) {
    const contrato = await this.repository.atualizar(id, input);
    return contrato;
  }
}
