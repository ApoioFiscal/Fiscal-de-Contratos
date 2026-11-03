import { prisma } from '../../prisma/client';
import { CreateContratanteInput, UpdateContratanteInput } from '../../common/schemas';

export class ContratanteRepository {
  async create(data: CreateContratanteInput) {
    return prisma.contratante.create({ data });
  }

  async findAll() {
    return prisma.contratante.findMany({ include: { licitacaoContrato: true } });
  }

  async findById(id: number) {
    return prisma.contratante.findUnique({ where: { id }, include: { licitacaoContrato: true } });
  }

  async update(id: number, data: UpdateContratanteInput) {
    return prisma.contratante.update({ where: { id }, data });
  }

  async delete(id: number) {
    return prisma.contratante.delete({ where: { id } });
  }
}
