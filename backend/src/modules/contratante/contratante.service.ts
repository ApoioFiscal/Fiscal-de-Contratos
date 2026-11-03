import { ContratanteRepository } from './contratante.repository';
import { CreateContratanteInput, UpdateContratanteInput } from '../../common/schemas';
import { NotFoundError } from '../../common/errors';

export class ContratanteService {
  constructor(private repository: ContratanteRepository) {}

  async create(input: CreateContratanteInput) {
    return this.repository.create(input);
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    const contratante = await this.repository.findById(id);
    if (!contratante) throw new NotFoundError('Contratante');
    return contratante;
  }

  async update(id: number, input: UpdateContratanteInput) {
    await this.findById(id);
    return this.repository.update(id, input);
  }

  async delete(id: number) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
