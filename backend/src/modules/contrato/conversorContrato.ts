import { Prisma } from "@prisma/client";
import { ContratoExtraction, ContratoExtractionSchema } from "../../common/contrato.schema";

/**
 * Shape usado pela criação aninhada no Prisma (partes/itens/dotações).
 * Isolado da API para facilitar testes.
 */
export type ContratoCreateData = {
  numero: string;
  numeroProcesso: string | null;
  modalidade: string | null;
  numeroModalidade: string | null;
  objeto: string | null;
  valorTotal: number | null;
  vigenciaInicio: Date | null;
  vigenciaFim: Date | null;
  itensConferemTotalTabela: boolean | null;
  itensConferemValorContrato: boolean | null;
  avisos: string[];
  /** Auditoria reduzida da extração (o OCR completo não é mais persistido). */
  dadosExtraidos: Prisma.InputJsonValue;
  importadoEm: Date;
  extraidoEm: Date;
  partes: { create: Array<Prisma.ContratoParteCreateWithoutContratoInput> };
  itens: { create: Array<Prisma.ContratoItemCreateWithoutContratoInput> };
  dotacoes: { create: Array<Prisma.ContratoDotacaoCreateWithoutContratoInput> };
};

export const mapearParaCriar = (data: ContratoExtraction): ContratoCreateData => {
  const parsed = ContratoExtractionSchema.parse(data);

  const mapearParte = (
    parte: ContratoExtraction["contratante"],
    papel: "CONTRATANTE" | "CONTRATADO",
  ) => ({
    papel,
    nome: parte.nome,
    documento: parte.documento,
  });

  return {
    numero: parsed.numero_contrato ?? "",
    numeroProcesso: parsed.numero_processo,
    modalidade: parsed.modalidade,
    numeroModalidade: parsed.numero_modalidade,
    objeto: parsed.objeto,
    valorTotal: parsed.valor_total,
    vigenciaInicio: parsed.vigencia.data_inicio ? new Date(parsed.vigencia.data_inicio) : null,
    vigenciaFim: parsed.vigencia.data_fim ? new Date(parsed.vigencia.data_fim) : null,
    itensConferemTotalTabela: parsed.validacoes.soma_itens_confere_total_da_tabela,
    itensConferemValorContrato: parsed.validacoes.soma_itens_confere_valor_do_contrato,
    avisos: parsed.avisos,
    dadosExtraidos: parsed as unknown as Prisma.InputJsonValue,
    importadoEm: new Date(),
    extraidoEm: new Date(),
    partes: {
      create: [
        mapearParte(parsed.contratante, "CONTRATANTE"),
        mapearParte(parsed.contratado, "CONTRATADO"),
      ],
    },
    itens: {
      create: parsed.itens.map((item) => ({
        codigo: item.codigo,
        descricao: item.descricao,
        unidade: item.unidade,
        unidadeOriginal: item.unidade_original,
        quantidade: item.quantidade,
        valorUnitario: item.valor_unitario,
        valorTotal: item.valor_total,
      })),
    },
    dotacoes: {
      create: parsed.dotacoes.map((d) => ({
        unidadeCodigo: d.unidade_codigo,
        unidade: d.unidade,
        funcionalProgramatica: d.funcional_programatica,
        acao: d.acao,
        ficha: d.ficha,
        elementoCodigo: d.elemento_codigo,
        elementoDescricao: d.elemento_descricao,
        naturezaCodigo: d.natureza_codigo,
        natureza: d.natureza,
        complemento: d.complemento,
      })),
    },
  };
};
