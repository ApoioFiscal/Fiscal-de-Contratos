import { SolicitacaoRepository } from './solicitacao.repository';
import { CreateSolicitacaoInput, UpdateSolicitacaoInput } from '../../common/schemas';
import { NotFoundError } from '../../common/errors';

export class SolicitacaoService {
  constructor(private repository: SolicitacaoRepository) {}

  async create(input: CreateSolicitacaoInput) {
    return this.repository.create(input);
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    const solicitacao = await this.repository.findById(id);
    if (!solicitacao) throw new NotFoundError('Solicitacao');
    return solicitacao;
  }

  async update(id: number, input: UpdateSolicitacaoInput) {
    await this.findById(id);
    return this.repository.update(id, input);
  }

  async delete(id: number) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
