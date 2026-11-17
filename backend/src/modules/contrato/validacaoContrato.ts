import { ValidationError } from "../../common/errors";

/**
 * Bloqueio da confirmação (RASCUNHO → ATIVA).
 *
 * Espelha o destaque em vermelho da barra de revisão: enquanto houver campo
 * essencial em branco (ou zero em quantidade/valor de item), a confirmação é
 * recusada. A divergência entre a soma dos itens e o valor total também bloqueia —
 * é a base do rastreio de valores e quantidades do sistema.
 *
 * `itensConferemTotalTabela` fica de fora de propósito: é apenas aviso histórico
 * do PDF e não impede a confirmação.
 */

export type EstadoFinalContrato = {
  numero: string | null;
  valorTotal: number | null;
  vigenciaInicio: Date | null;
  vigenciaFim: Date | null;
  partes: Array<{ papel: string; nome: string | null; documento: string | null }>;
  itens: Array<{
    descricao: string;
    unidade: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number | null;
  }>;
  dotacoes: Array<{ unidadeCodigo: string; unidade: string }>;
};

const arredondar = (valor: number) => Math.round(valor * 100) / 100;
const preenchido = (valor: string | null | undefined) => Boolean(valor && valor.trim());
const positivo = (valor: number | null | undefined) => typeof valor === "number" && valor > 0;

export const somarItens = (itens: EstadoFinalContrato["itens"]) =>
  arredondar(
    itens.reduce(
      (acc, item) => acc + (item.valorTotal ?? arredondar(item.quantidade * item.valorUnitario)),
      0,
    ),
  );

export const calcularConferenciaItens = (
  itens: EstadoFinalContrato["itens"],
  valorTotal: number | null,
): boolean | null =>
  valorTotal == null
    ? null
    : arredondar(Math.abs(somarItens(itens) - valorTotal)) <= 0.01;

export const listarCamposPendentes = (final: EstadoFinalContrato): string[] => {
  const pendentes: string[] = [];

  if (!preenchido(final.numero)) pendentes.push("Número do contrato");
  if (!positivo(final.valorTotal)) pendentes.push("Valor total");
  if (!final.vigenciaInicio) pendentes.push("Vigência – início");
  if (!final.vigenciaFim) pendentes.push("Vigência – fim");

  for (const papel of ["CONTRATANTE", "CONTRATADO"] as const) {
    const parte = final.partes.find((p) => p.papel === papel);
    const rotulo = papel === "CONTRATANTE" ? "Contratante" : "Contratado";
    if (!preenchido(parte?.nome)) pendentes.push(`${rotulo} – nome`);
    if (!preenchido(parte?.documento)) pendentes.push(`${rotulo} – documento`);
  }

  if (final.itens.length === 0) {
    pendentes.push("Itens (ao menos um)");
  } else {
    final.itens.forEach((item, indice) => {
      const rotulo = `Item ${indice + 1}`;
      if (!preenchido(item.descricao)) pendentes.push(`${rotulo} – descrição`);
      if (!preenchido(item.unidade)) pendentes.push(`${rotulo} – unidade`);
      if (!positivo(item.quantidade)) pendentes.push(`${rotulo} – quantidade`);
      if (!positivo(item.valorUnitario)) pendentes.push(`${rotulo} – valor unitário`);
      if (!positivo(item.valorTotal)) pendentes.push(`${rotulo} – valor total`);
    });
  }

  if (final.dotacoes.length === 0) {
    pendentes.push("Dotações (ao menos uma)");
  } else {
    final.dotacoes.forEach((dotacao, indice) => {
      const rotulo = `Dotação ${indice + 1}`;
      if (!preenchido(dotacao.unidadeCodigo)) pendentes.push(`${rotulo} – código da unidade`);
      if (!preenchido(dotacao.unidade)) pendentes.push(`${rotulo} – unidade`);
    });
  }

  return pendentes;
};

export const validarParaConfirmacao = (final: EstadoFinalContrato): void => {
  const pendentes = listarCamposPendentes(final);
  if (pendentes.length > 0) {
    throw new ValidationError(
      `Não é possível confirmar o contrato. Campos essenciais pendentes: ${pendentes.join(", ")}.`,
      { camposPendentes: pendentes },
    );
  }

  if (calcularConferenciaItens(final.itens, final.valorTotal) !== true) {
    throw new ValidationError(
      "Não é possível confirmar o contrato: a soma dos itens não confere com o valor total. Revise os itens e o valor total antes de salvar.",
    );
  }
};
