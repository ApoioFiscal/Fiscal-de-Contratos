import type { Contrato } from "@/types/domain";

/**
 * Espelho frontend do bloqueio de confirmação do backend
 * (`backend/src/modules/contrato/validacaoContrato.ts`).
 *
 * As chaves devolvidas por `listarCamposPendentes` são estáveis e servem para
 * pintar de vermelho só o campo pendente no formulário de revisão. O estado é
 * sempre derivado do formulário (draft), nunca de `dadosExtraidos` — o OCR é
 * histórico, a revisão é a fonte atual.
 */

export type EstadoContratoValidacao = {
  numero: string | null;
  valorTotal: number | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  partes: Array<{ papel: string; nome: string | null; documento: string | null }>;
  itens: Array<{
    /** Chave do draft (string) ou id do item salvo (number). */
    id?: string | number;
    descricao: string;
    unidade: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number | null;
  }>;
  dotacoes: Array<{
    id?: string | number;
    unidadeCodigo: string;
    unidade: string;
  }>;
};

const arredondar = (valor: number) => Math.round(valor * 100) / 100;
const preenchido = (valor: string | null | undefined) => Boolean(valor && valor.trim());
const positivo = (valor: number | null | undefined) => typeof valor === "number" && valor > 0;
const chave = (prefixo: string, id: string | number | undefined, indice: number) =>
  `${prefixo}:${id ?? indice}`;

export const somarItens = (itens: EstadoContratoValidacao["itens"]) =>
  arredondar(
    itens.reduce(
      (acc, item) => acc + (item.valorTotal ?? arredondar(item.quantidade * item.valorUnitario)),
      0,
    ),
  );

export const calcularConferenciaItens = (
  itens: EstadoContratoValidacao["itens"],
  valorTotal: number | null,
): boolean | null =>
  valorTotal == null ? null : arredondar(Math.abs(somarItens(itens) - valorTotal)) <= 0.01;

export const listarCamposPendentes = (estado: EstadoContratoValidacao): string[] => {
  const pendentes: string[] = [];

  if (!preenchido(estado.numero)) pendentes.push("numero");
  if (!positivo(estado.valorTotal)) pendentes.push("valorTotal");
  if (!preenchido(estado.vigenciaInicio)) pendentes.push("vigenciaInicio");
  if (!preenchido(estado.vigenciaFim)) pendentes.push("vigenciaFim");

  for (const papel of ["CONTRATANTE", "CONTRATADO"] as const) {
    const parte = estado.partes.find((p) => p.papel === papel);
    if (!preenchido(parte?.nome)) pendentes.push(`parte.${papel}.nome`);
    if (!preenchido(parte?.documento)) pendentes.push(`parte.${papel}.documento`);
  }

  if (estado.itens.length === 0) {
    pendentes.push("itens");
  } else {
    estado.itens.forEach((item, indice) => {
      const id = chave("item", item.id, indice);
      if (!preenchido(item.descricao)) pendentes.push(`${id}.descricao`);
      if (!preenchido(item.unidade)) pendentes.push(`${id}.unidade`);
      if (!positivo(item.quantidade)) pendentes.push(`${id}.quantidade`);
      if (!positivo(item.valorUnitario)) pendentes.push(`${id}.valorUnitario`);
      if (!positivo(item.valorTotal)) pendentes.push(`${id}.valorTotal`);
    });
  }

  if (estado.dotacoes.length === 0) {
    pendentes.push("dotacoes");
  } else {
    estado.dotacoes.forEach((dotacao, indice) => {
      const id = chave("dotacao", dotacao.id, indice);
      if (!preenchido(dotacao.unidadeCodigo)) pendentes.push(`${id}.unidadeCodigo`);
      if (!preenchido(dotacao.unidade)) pendentes.push(`${id}.unidade`);
    });
  }

  return pendentes;
};

export const podeConfirmarContrato = (estado: EstadoContratoValidacao): boolean =>
  listarCamposPendentes(estado).length === 0 &&
  calcularConferenciaItens(estado.itens, estado.valorTotal) === true;

/** Estado de um contrato já persistido (usado pelo botão da tela de lista). */
export const estadoDoContrato = (contrato: Contrato): EstadoContratoValidacao => ({
  numero: contrato.numero,
  valorTotal: contrato.valorTotal,
  vigenciaInicio: contrato.vigenciaInicio,
  vigenciaFim: contrato.vigenciaFim,
  partes: contrato.partes ?? [],
  itens: (contrato.itens ?? []).map((item) => ({
    id: item.id,
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorTotal: item.valorTotal,
  })),
  dotacoes: (contrato.dotacoes ?? []).map((dotacao) => ({
    id: dotacao.id,
    unidadeCodigo: dotacao.unidadeCodigo,
    unidade: dotacao.unidade,
  })),
});

export const MENSAGEM_DADOS_NAO_EXTRAIDOS =
  "Alguns dados não foram extraídos corretamente. Por favor, revise-os antes de salvar o Contrato.";
