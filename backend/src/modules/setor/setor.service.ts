import { SetorRepository } from "./setor.repository";
import { CreateSetorInput, UpdateSetorInput } from "../../common/schemas";
import { DuplicateDataError, NotFoundError } from "../../common/errors";

export class SetorService {
  constructor(private repository: SetorRepository) {}

  async create(input: CreateSetorInput) {
    const siglaJaExiste = await this.repository.findBySigla(input.sigla);
    if (siglaJaExiste) {
      throw new DuplicateDataError("Sigla");
    }

    return this.repository.create(input);
  }

  async update(id: number, input: UpdateSetorInput){
    const setor = await this.repository.findById(id)

    if(!setor){
      throw new NotFoundError("Setor não encontrado")
    }

    await this.repository.update(id, input)
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    const setor = await this.repository.findById(id);
    if (!setor) {
      throw new NotFoundError("Setor");
    }
    return setor;
  }

  async deleteById(id: number) {
    const setor = await this.repository.findById(id)

    if(!setor){
      throw new NotFoundError("Setor não encontrado")
    }

    return await this.repository.deleteById(id)
  }
}