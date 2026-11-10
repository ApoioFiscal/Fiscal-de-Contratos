import { prisma } from "../../prisma/client";
import { StatusContrato } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ContratoCreateData } from "./conversorContrato";
import {
  AtualizarContratoInput,
  ParteContratoRevisao,
  SignatarioContratoRevisao,
  ItemContratoRevisao,
  DotacaoContratoRevisao,
} from "../../common/contrato.schema";
import {
  NotFoundError,
  DuplicateContratoError,
  ContratoNaoEditavelError,
  ValidationError,
} from "../../common/errors";

const contratoInclude = {
  partes: true,
  signatarios: { orderBy: { ordem: "asc" as const } },
  itens: { orderBy: { id: "asc" as const } },
  dotacoes: { orderBy: { id: "asc" as const } },
  setores: { include: { setor: true }, orderBy: { id: "asc" as const } },
};

const arredondar = (valor: number) => Math.round(valor * 100) / 100;

const dadosParte = (parte: ParteContratoRevisao) => ({
  nome: parte.nome ?? null,
  documento: parte.documento ?? null,
  tipoDocumento: parte.tipoDocumento ?? null,
  endereco: parte.endereco ?? null,
  representanteNome: parte.representanteNome ?? null,
  representanteCargo: parte.representanteCargo ?? null,
  representanteCpf: parte.representanteCpf ?? null,
  representanteRg: parte.representanteRg ?? null,
  representanteOrgaoEmissorRg: parte.representanteOrgaoEmissorRg ?? null,
  representanteNacionalidade: parte.representanteNacionalidade ?? null,
  representanteEstadoCivil: parte.representanteEstadoCivil ?? null,
  representanteProfissao: parte.representanteProfissao ?? null,
  representanteEndereco: parte.representanteEndereco ?? null,
});

const dadosSignatario = (signatario: SignatarioContratoRevisao, ordem: number) => ({
  papel: signatario.papel,
  ordem: signatario.ordem ?? ordem,
  nome: signatario.nome ?? null,
  cargo: signatario.cargo ?? null,
  cpf: signatario.cpf ?? null,
  cnpj: signatario.cnpj ?? null,
  rg: signatario.rg ?? null,
  orgaoEmissorRg: signatario.orgaoEmissorRg ?? null,
  nacionalidade: signatario.nacionalidade ?? null,
  estadoCivil: signatario.estadoCivil ?? null,
  profissao: signatario.profissao ?? null,
  endereco: signatario.endereco ?? null,
  confirmadoNoBloco: signatario.confirmadoNoBloco ?? false,
  legivel: signatario.legivel ?? true,
});

const dadosItem = (item: ItemContratoRevisao) => ({
  codigo: item.codigo ?? null,
  descricao: item.descricao,
  unidade: item.unidade,
  unidadeOriginal: item.unidadeOriginal ?? null,
  quantidade: item.quantidade,
  valorUnitario: item.valorUnitario,
  valorTotal: item.valorTotal ?? arredondar(item.quantidade * item.valorUnitario),
  correcoes: item.correcoes ?? [],
});

const dadosDotacao = (dotacao: DotacaoContratoRevisao) => ({
  unidadeCodigo: dotacao.unidadeCodigo,
  unidade: dotacao.unidade,
  funcionalProgramatica: dotacao.funcionalProgramatica ?? null,
  acao: dotacao.acao ?? null,
  ficha: dotacao.ficha ?? null,
  elementoCodigo: dotacao.elementoCodigo ?? null,
  elementoDescricao: dotacao.elementoDescricao ?? null,
  naturezaCodigo: dotacao.naturezaCodigo ?? null,
  natureza: dotacao.natureza ?? null,
  complemento: dotacao.complemento ?? null,
});


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

  async delete(id: number) {
    const existe = await prisma.contrato.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundError("Contrato");

    await prisma.$transaction(async (tx) => {
      await tx.termoRenovacao.deleteMany({ where: { idContrato: id } });
      await tx.avaliacao.deleteMany({ where: { idContrato: id } });
      await tx.notaFiscalItem.deleteMany({ where: { notaFiscal: { idContrato: id } } });
      await tx.notaFiscal.deleteMany({ where: { idContrato: id } });
      await tx.movimentacaoEstoque.deleteMany({ where: { itemContrato: { idContrato: id } } });
      await tx.pedidoItem.deleteMany({ where: { pedido: { idContrato: id } } });
      await tx.pedido.deleteMany({ where: { idContrato: id } });
      await tx.contratoSetor.deleteMany({ where: { idContrato: id } });
      await tx.contratoDotacao.deleteMany({ where: { idContrato: id } });
      await tx.contratoItem.deleteMany({ where: { idContrato: id } });
      await tx.contratoSignatario.deleteMany({ where: { idContrato: id } });
      await tx.contratoParte.deleteMany({ where: { idContrato: id } });
      await tx.contrato.delete({ where: { id } });
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

    try {
      return await prisma.contrato.create({
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
    } catch (error) {
      // Corrida entre duas importações do mesmo PDF: o service checa antes, mas
      // quem perder a corrida recebe o mesmo 409 em vez de um 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DuplicateContratoError(input.data.numero);
      }
      throw error;
    }
  }

  async atualizar(id: number, input: AtualizarContratoInput) {
    const atual = await prisma.contrato.findUnique({
      where: { id },
      select: { id: true, status: true, numero: true, valorTotal: true },
    });

    if (!atual) {
      throw new NotFoundError("Contrato");
    }

    // A revisão manual existe para corrigir o que o OCR não leu. Depois de
    // confirmado, o contrato é a fonte oficial e não pode mais ser reescrito.
    if (atual.status !== StatusContrato.RASCUNHO) {
      throw new ContratoNaoEditavelError();
    }

    const numeroFinal = (input.numero ?? atual.numero ?? "").trim();

    if (input.confirmar && !numeroFinal) {
      throw new ValidationError("Informe o número do contrato antes de confirmar a revisão.");
    }

    if (input.numero !== undefined && input.numero !== atual.numero) {
      const existente = await prisma.contrato.findUnique({
        where: { numero: input.numero },
        select: { id: true },
      });
      if (existente && existente.id !== id) throw new DuplicateContratoError(input.numero);
    }

    const data: Prisma.ContratoUncheckedUpdateInput = {};

    if (input.numero !== undefined) data.numero = input.numero;
    if (input.numeroProcesso !== undefined) data.numeroProcesso = input.numeroProcesso;
    if (input.modalidade !== undefined) data.modalidade = input.modalidade;
    if (input.numeroModalidade !== undefined) data.numeroModalidade = input.numeroModalidade;
    if (input.objeto !== undefined) data.objeto = input.objeto;
    if (input.valorTotal !== undefined) data.valorTotal = input.valorTotal;
    if (input.vigenciaInicio !== undefined) {
      data.vigenciaInicio = input.vigenciaInicio ? new Date(input.vigenciaInicio) : null;
    }
    if (input.vigenciaFim !== undefined) {
      data.vigenciaFim = input.vigenciaFim ? new Date(input.vigenciaFim) : null;
    }
    if (input.vigenciaFimCalculada !== undefined) {
      data.vigenciaFimCalculada = input.vigenciaFimCalculada;
    }
    if (input.vigenciaTrecho !== undefined) data.vigenciaTrecho = input.vigenciaTrecho;
    if (input.foro !== undefined) data.foro = input.foro;
    if (input.fundamentacaoLegal !== undefined) data.fundamentacaoLegal = input.fundamentacaoLegal;
    if (input.condicoes !== undefined) {
      data.condicoes =
        input.condicoes === null
          ? Prisma.DbNull
          : (input.condicoes as Prisma.InputJsonValue);
    }
    if (input.assinaturaLocal !== undefined) data.assinaturaLocal = input.assinaturaLocal;
    if (input.assinaturaData !== undefined) {
      data.assinaturaData = input.assinaturaData ? new Date(input.assinaturaData) : null;
    }
    if (input.assinaturaDigital !== undefined) data.assinaturaDigital = input.assinaturaDigital;
    if (input.assinaturaPlataforma !== undefined) {
      data.assinaturaPlataforma = input.assinaturaPlataforma;
    }
    if (input.assinaturaAssinante !== undefined) {
      data.assinaturaAssinante = input.assinaturaAssinante;
    }

    // Recalcula a conferência dos itens com o valor do contrato revisado.
    // `itensConferemTotalTabela` continua sendo o registro histórico do PDF.
    if (input.itens !== undefined) {
      const somaItens = input.itens.reduce(
        (acc, item) => acc + (item.valorTotal ?? arredondar(item.quantidade * item.valorUnitario)),
        0,
      );
      const valorContrato = input.valorTotal !== undefined ? input.valorTotal : atual.valorTotal;
      data.itensConferemValorContrato =
        valorContrato == null ? null : Math.abs(somaItens - valorContrato) <= 0.01;
    }

    // `confirmar: true` na revisão promove RASCUNHO → ATIVA.
    if (input.confirmar) {
      data.status = StatusContrato.ATIVA;
    }

    try {
      return await prisma.$transaction(async (tx) => {
        await tx.contrato.update({ where: { id }, data });

        // Partes: uma linha por papel (contratante/contratado).
        if (input.partes !== undefined) {
          for (const parte of input.partes) {
            await tx.contratoParte.upsert({
              where: { idContrato_papel: { idContrato: id, papel: parte.papel } },
              create: { idContrato: id, papel: parte.papel, ...dadosParte(parte) },
              update: dadosParte(parte),
            });
          }
        }

        // Signatários: a revisão envia a lista completa, então substitui.
        if (input.signatarios !== undefined) {
          await tx.contratoSignatario.deleteMany({ where: { idContrato: id } });
          if (input.signatarios.length > 0) {
            await tx.contratoSignatario.createMany({
              data: input.signatarios.map((signatario, ordem) => ({
                idContrato: id,
                ...dadosSignatario(signatario, ordem),
              })),
            });
          }
        }

        // Dotações: mesma lógica dos signatários (lista completa).
        if (input.dotacoes !== undefined) {
          await tx.contratoDotacao.deleteMany({ where: { idContrato: id } });
          if (input.dotacoes.length > 0) {
            await tx.contratoDotacao.createMany({
              data: input.dotacoes.map((dotacao) => ({
                idContrato: id,
                ...dadosDotacao(dotacao),
              })),
            });
          }
        }

        // Itens: atualiza os existentes, cria os novos e remove os retirados.
        if (input.itens !== undefined) {
          const itensAtuais = await tx.contratoItem.findMany({
            where: { idContrato: id },
            select: { id: true },
          });
          const idsAtuais = new Set(itensAtuais.map((item) => item.id));
          const enviados = new Set(
            input.itens
              .map((item) => item.id)
              .filter((itemId): itemId is number => typeof itemId === "number"),
          );

          const idsInvalidos = [...enviados].filter((itemId) => !idsAtuais.has(itemId));
          if (idsInvalidos.length > 0) {
            throw new ValidationError("A revisão contém itens que não pertencem a este contrato.");
          }

          const removidos = itensAtuais
            .map((item) => item.id)
            .filter((itemId) => !enviados.has(itemId));

          if (removidos.length > 0) {
            // Item com pedido/NF/movimentação não pode sumir: quebraria o histórico.
            const [pedidos, notas, movimentacoes] = await Promise.all([
              tx.pedidoItem.count({ where: { idContratoItem: { in: removidos } } }),
              tx.notaFiscalItem.count({ where: { idContratoItem: { in: removidos } } }),
              tx.movimentacaoEstoque.count({ where: { idContratoItem: { in: removidos } } }),
            ]);

            if (pedidos + notas + movimentacoes > 0) {
              throw new ValidationError(
                "Não é possível remover itens que já possuem pedidos, notas fiscais ou movimentações de estoque.",
              );
            }

            await tx.contratoItem.deleteMany({ where: { id: { in: removidos } } });
          }

          for (const item of input.itens) {
            if (item.id !== undefined) {
              await tx.contratoItem.update({
                where: { id: item.id },
                data: dadosItem(item),
              });
            } else {
              await tx.contratoItem.create({
                data: { idContrato: id, ...dadosItem(item) },
              });
            }
          }
        }

        // Vínculos contrato ↔ secretaria (origem DOTACAO/MANUAL) enviados na revisão.
        if (input.setores !== undefined) {
          await tx.contratoSetor.deleteMany({ where: { idContrato: id } });

          const vinculados = new Map<number, "DOTACAO" | "MANUAL">();
          for (const setor of input.setores) {
            if (setor.idSetor > 0) vinculados.set(setor.idSetor, setor.origem);
          }

          if (vinculados.size > 0) {
            await tx.contratoSetor.createMany({
              data: [...vinculados.entries()].map(([idSetor, origem]) => ({
                idContrato: id,
                idSetor,
                origem,
              })),
            });
          }
        }

        return tx.contrato.findUnique({
          where: { id },
          include: {
            ...contratoInclude,
            setores: { include: { setor: true }, orderBy: { id: "asc" } },
          },
        });
      });
    } catch (error) {
      // Corrida entre revisões/importações do mesmo número: devolve o mesmo 409
      // amigável em vez do 500 genérico.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const alvo = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");
        if (!alvo || alvo.includes("numero")) {
          throw new DuplicateContratoError(numeroFinal);
        }
      }
      throw error;
    }
  }
}
