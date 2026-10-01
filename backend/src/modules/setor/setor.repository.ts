import { prisma } from "../../prisma/client";
import { CreateSetorInput, UpdateSetorInput } from "../../common/schemas";

export class SetorRepository {
  async create(data: CreateSetorInput) {
    return prisma.setor.create({ data });
  }

  async update(id: number, data: UpdateSetorInput) {
     return prisma.setor.update({
      where: { id },
      data
     })
  }

  async findById(id: number) {
    return prisma.setor.findUnique({ where: { id } });
  }

  async findBySigla(sigla: string) {
    return prisma.setor.findUnique({ where: { sigla } });
  }

  async findAll() {
    return prisma.setor.findMany({ orderBy: { nome: "asc" } });
  }

  async deleteById(id: number) {
    await prisma.setor.delete({
      where: { id }
    })
  }
}