import { prisma } from '../../prisma/client';
import { CreateContratadoInput, UpdateContratadoInput } from '../../common/schemas';

export class ContratadoRepository {
  async create(data: CreateContratadoInput) {
    return prisma.contratado.create({ data });
  }

  async findAll() {
    return prisma.contratado.findMany({ include: { licitacaoContrato: true } });
  }

  async findById(id: number) {
    return prisma.contratado.findUnique({ where: { id }, include: { licitacaoContrato: true } });
  }

  async update(id: number, data: UpdateContratadoInput) {
    return prisma.contratado.update({ where: { id }, data });
  }

  async delete(id: number) {
    return prisma.contratado.delete({ where: { id } });
  }
}
