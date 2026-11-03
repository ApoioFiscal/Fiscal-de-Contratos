import { ContratadoRepository } from './contratado.repository';
import { CreateContratadoInput, UpdateContratadoInput } from '../../common/schemas';
import { NotFoundError } from '../../common/errors';

export class ContratadoService {
  constructor(private repository: ContratadoRepository) {}

  async create(input: CreateContratadoInput) {
    return this.repository.create(input);
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    const contratado = await this.repository.findById(id);
    if (!contratado) throw new NotFoundError('Contratado');
    return contratado;
  }

  async update(id: number, input: UpdateContratadoInput) {
    await this.findById(id);
    return this.repository.update(id, input);
  }

  async delete(id: number) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
