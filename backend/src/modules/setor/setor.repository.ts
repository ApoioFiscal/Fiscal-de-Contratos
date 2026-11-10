import { prisma } from "../../prisma/client";
import { CreateSetorInput, UpdateSetorInput } from "../../common/schemas";

export interface VinculosSetor {
  usuarios: number;
  pedidos: number;
  termosRenovacao: number;
  subSetores: number;
}

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

  // Vínculos que impedem a exclusão de um setor (evitando erro de FK).
  async contarVinculos(id: number): Promise<VinculosSetor> {
    const [usuarios, pedidos, termosRenovacao, subSetores] = await prisma.$transaction([
      prisma.usuario.count({ where: { idSetor: id } }),
      prisma.pedido.count({ where: { idSetorCriador: id } }),
      prisma.termoRenovacao.count({ where: { idSetorSolicitante: id } }),
      prisma.setor.count({ where: { idSetor: id } }),
    ]);

    return { usuarios, pedidos, termosRenovacao, subSetores };
  }

  // Remove os vínculos com contratos e o próprio setor na mesma transação.
  async deleteById(id: number) {
    return prisma.$transaction(async (tx) => {
      await tx.contratoSetor.deleteMany({ where: { idSetor: id } });
      return tx.setor.delete({ where: { id } });
    });
  }
}
