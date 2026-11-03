import { prisma } from "../../prisma/client";
import { StatusContrato } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ContratoCreateData } from "./conversorContrato";
import { AtualizarContratoInput } from "../../common/contrato.schema";
import { NotFoundError } from "../../common/errors";

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

  async atualizar(id: number, input: AtualizarContratoInput) {
    const atual = await prisma.contrato.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!atual) {
      throw new NotFoundError("Contrato");
    }

    const data: Prisma.ContratoUncheckedUpdateInput = {};

    if (input.numero_contrato !== undefined) data.numero = input.numero_contrato ?? undefined;
    if (input.numero_processo !== undefined) data.numeroProcesso = input.numero_processo;
    if (input.modalidade !== undefined) data.modalidade = input.modalidade;
    if (input.numero_modalidade !== undefined) data.numeroModalidade = input.numero_modalidade;
    if (input.objeto !== undefined) data.objeto = input.objeto;
    if (input.valor_total !== undefined) data.valorTotal = input.valor_total;
    if (input.vigencia?.data_inicio !== undefined) {
      data.vigenciaInicio = input.vigencia.data_inicio ? new Date(input.vigencia.data_inicio) : null;
    }
    if (input.vigencia?.data_fim !== undefined) {
      data.vigenciaFim = input.vigencia.data_fim ? new Date(input.vigencia.data_fim) : null;
    }
    if (input.vigencia?.data_fim_calculada !== undefined) {
      data.vigenciaFimCalculada = input.vigencia.data_fim_calculada;
    }
    if (input.vigencia?.trecho !== undefined) data.vigenciaTrecho = input.vigencia.trecho;
    if (input.foro !== undefined) data.foro = input.foro;
    if (input.valor_total !== undefined) data.valorTotal = input.valor_total;
    if (input.fundamentacao_legal !== undefined) data.fundamentacaoLegal = input.fundamentacao_legal;
    if (input.condicoes !== undefined) data.condicoes = input.condicoes as Prisma.InputJsonValue;
    if (input.assinatura !== undefined) {
      data.assinaturaLocal = input.assinatura.local;
      data.assinaturaData = input.assinatura.data ? new Date(input.assinatura.data) : null;
      data.assinaturaDigital = input.assinatura.assinatura_digital?.detectada ?? false;
      data.assinaturaPlataforma = input.assinatura.assinatura_digital?.plataforma ?? null;
      data.assinaturaAssinante = input.assinatura.assinatura_digital?.assinante ?? null;
    }

    // `confirmar: true` na revisão promove RASCUNHO → ATIVA.
    if (input.confirmar) {
      data.status = StatusContrato.ATIVA;
    }

    const contrato = await prisma.contrato.update({
      where: { id },
      data,
      include: {
        ...contratoInclude,
        setores: { include: { setor: true }, orderBy: { id: "asc" } },
      },
    });

    // Vínculos contrato ↔ secretaria (origem DOTACAO/MANUAL) enviados na revisão.
    if (input.setores !== undefined) {
      await prisma.contratoSetor.deleteMany({ where: { idContrato: id } });

      const vinculados = input.setores.filter((s) => s.idSetor > 0);
      if (vinculados.length > 0) {
        await prisma.contratoSetor.createMany({
          data: vinculados.map((s) => ({
            idContrato: id,
            idSetor: s.idSetor,
            origem: s.origem,
          })),
        });
      }
    }

    return contrato;
  }
}
