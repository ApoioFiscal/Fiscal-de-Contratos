import { prisma } from '../../prisma/client';
import { CreateSolicitacaoInput, UpdateSolicitacaoInput } from '../../common/schemas';

export class SolicitacaoRepository {
  async create(data: CreateSolicitacaoInput) {
    return prisma.solicitacao.create({ data, include: { usuario: true, itemLicitado: true } });
  }

  async findAll() {
    return prisma.solicitacao.findMany({ include: { usuario: true, itemLicitado: true }, orderBy: { dataSolicitacao: 'desc' } });
  }

  async findById(id: number) {
    return prisma.solicitacao.findUnique({ where: { id }, include: { usuario: true, itemLicitado: true } });
  }

  async update(id: number, data: UpdateSolicitacaoInput) {
    return prisma.solicitacao.update({ where: { id }, data, include: { usuario: true, itemLicitado: true } });
  }

  async delete(id: number) {
    return prisma.solicitacao.delete({ where: { id } });
  }
}
