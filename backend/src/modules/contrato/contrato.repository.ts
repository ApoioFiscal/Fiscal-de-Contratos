import { prisma } from "../../prisma/client";
import { StatusContrato } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ContratoCreateData } from "./conversorContrato";

const contratoInclude = {
  partes: true,
  signatarios: { orderBy: { ordem: "asc" as const } },
  itens: { orderBy: { id: "asc" as const } },
  dotacoes: { orderBy: { id: "asc" as const } },
  setores: { include: { setor: true }, orderBy: { id: "asc" as const } },
};

export class ContratoRepository {
  async findAll() {
    return prisma.contrato.findMany({
      include: {
        ...contratoInclude,
        setores: { include: { setor: true }, orderBy: { id: "asc" } },
      },
      orderBy: { importadoEm: "desc" },
    });
  }

  async findById(id: number) {
    return prisma.contrato.findUnique({
      where: { id },
      include: {
        ...contratoInclude,
        setores: { include: { setor: true }, orderBy: { id: "asc" } },
      },
    });
  }

  async findByNumero(numero: string) {
    return prisma.contrato.findUnique({ where: { numero } });
  }

  async importar(input: {
    data: ContratoCreateData;
    arquivoPdf: string | null;
    arquivoPdfNome: string | null;
  }) {
    const dotacoes = input.data.dotacoes.create as Array<{ unidade?: string | null }>;
    const setoresPorUnidade = new Map<string, { idSetor: number }>();

    for (const dotacao of dotacoes) {
      const unidade = String(dotacao?.unidade ?? "").trim();
      const chave = unidade.toLowerCase();
      if (!chave || setoresPorUnidade.has(chave)) continue;

      const setor = await prisma.setor.findFirst({
        where: {
          OR: [
            { nome: { equals: unidade, mode: "insensitive" } },
            { sigla: { equals: unidade, mode: "insensitive" } },
          ],
        },
      });

      if (setor) setoresPorUnidade.set(chave, { idSetor: setor.id });
    }

    const contrato = await prisma.contrato.create({
      data: {
        ...input.data,
        status: StatusContrato.RASCUNHO,
        setores: {
          create: [...setoresPorUnidade.entries()]
            .filter(([, v]) => v.idSetor > 0)
            .map(([chave, v]) => {
              const origem = dotacoes.some(
                (d) => String(d?.unidade ?? "").trim().toLowerCase() === chave,
              )
                ? "DOTACAO"
                : "MANUAL";

              return { origem, setor: { connect: { id: v.idSetor } } };
            }),
        },
      },
      include: {
        ...contratoInclude,
        setores: { include: { setor: true }, orderBy: { id: "asc" } },
      },
    });

    return contrato;
  }
}
