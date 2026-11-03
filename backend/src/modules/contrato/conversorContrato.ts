import { Prisma } from "@prisma/client";
import { ContratoExtraction, ContratoExtractionSchema, ParteContratoSchema, SignatarioContratoSchema } from "../../common/contrato.schema";

/**
 * Shape usado pela criação aninhada no Prisma (partes/signatarios/itens/dotações).
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
  vigenciaFimCalculada: boolean;
  vigenciaTrecho: string | null;
  foro: string | null;
  assinaturaLocal: string | null;
  assinaturaData: Date | null;
  assinaturaDigital: boolean;
  assinaturaPlataforma: string | null;
  assinaturaAssinante: string | null;
  fundamentacaoLegal: string[];
  condicoes: Prisma.InputJsonValue;
  itensConferemTotalTabela: boolean | null;
  itensConferemValorContrato: boolean | null;
  avisos: string[];
  dadosExtraidos: Prisma.InputJsonValue;
  importadoEm: Date;
  extraidoEm: Date;
  partes: { create: Array<Prisma.ContratoParteCreateWithoutContratoInput> };
  signatarios: { create: Prisma.ContratoSignatarioCreateWithoutContratoInput[] };
  itens: { create: Array<Prisma.ContratoItemCreateWithoutContratoInput> };
  dotacoes: { create: Array<Prisma.ContratoDotacaoCreateWithoutContratoInput> };
};

export const mapearParaCriar = (data: ContratoExtraction): ContratoCreateData => {
  const parsed = ContratoExtractionSchema.parse(data);

  const mapearParte = (
    parte: ContratoExtraction["contratante"],
    papel: "CONTRATANTE" | "CONTRATADO",
  ) => {
    const p = ParteContratoSchema.parse(parte);
    const representante = p.representante;
    return {
      papel,
      nome: p.nome,
      documento: p.documento,
      tipoDocumento: p.tipo_documento,
      endereco: p.endereco,
      representanteNome: representante?.nome ?? null,
      representanteCargo: representante?.cargo ?? null,
      representanteCpf: representante?.cpf ?? null,
      representanteRg: representante?.rg ?? null,
      representanteOrgaoEmissorRg: representante?.orgao_emissor_rg ?? null,
      representanteNacionalidade: representante?.nacionalidade ?? null,
      representanteEstadoCivil: representante?.estado_civil ?? null,
      representanteProfissao: representante?.profissao ?? null,
      representanteEndereco: representante?.endereco ?? null,
    };
  };

  return {
    numero: parsed.numero_contrato ?? "",
    numeroProcesso: parsed.numero_processo,
    modalidade: parsed.modalidade,
    numeroModalidade: parsed.numero_modalidade,
    objeto: parsed.objeto,
    valorTotal: parsed.valor_total,
    vigenciaInicio: parsed.vigencia.data_inicio ? new Date(parsed.vigencia.data_inicio) : null,
    vigenciaFim: parsed.vigencia.data_fim ? new Date(parsed.vigencia.data_fim) : null,
    vigenciaFimCalculada: parsed.vigencia.data_fim_calculada,
    vigenciaTrecho: parsed.vigencia.trecho,
    foro: parsed.foro,
    assinaturaLocal: parsed.assinatura.local,
    assinaturaData: parsed.assinatura.data ? new Date(parsed.assinatura.data) : null,
    assinaturaDigital: parsed.assinatura.assinatura_digital.detectada,
    assinaturaPlataforma: parsed.assinatura.assinatura_digital.plataforma,
    assinaturaAssinante: parsed.assinatura.assinatura_digital.assinante,
    fundamentacaoLegal: parsed.fundamentacao_legal,
    condicoes: parsed.condicoes as Prisma.InputJsonValue,
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
    signatarios: {
      create: parsed.signatarios.map((s, i) => ({
        ...SignatarioContratoSchema.parse(s),
        ordem: i,
      })),
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
        correcoes: item.correcoes,
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
