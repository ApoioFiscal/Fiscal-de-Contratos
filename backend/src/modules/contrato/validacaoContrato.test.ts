import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../../common/errors";
import {
  calcularConferenciaItens,
  listarCamposPendentes,
  validarParaConfirmacao,
  type EstadoFinalContrato,
} from "./validacaoContrato";

const estadoValido = (): EstadoFinalContrato => ({
  numero: "00141/2026-SDC",
  valorTotal: 100,
  vigenciaInicio: new Date("2026-01-01"),
  vigenciaFim: new Date("2026-12-31"),
  partes: [
    { papel: "CONTRATANTE", nome: "Prefeitura Municipal de Marizópolis", documento: "01.612.941/0001-49" },
    { papel: "CONTRATADO", nome: "Fornecedor LTDA", documento: "11.222.333/0001-44" },
  ],
  itens: [
    {
      descricao: "Caneta",
      unidade: "Cx",
      quantidade: 10,
      valorUnitario: 10,
      valorTotal: 100,
    },
  ],
  dotacoes: [{ unidadeCodigo: "02.010", unidade: "GABINETE DO PREFEITO" }],
});

test("estado completo permite a confirmação", () => {
  assert.deepEqual(listarCamposPendentes(estadoValido()), []);
  assert.doesNotThrow(() => validarParaConfirmacao(estadoValido()));
});

test("campos essenciais em branco bloqueiam a confirmação", () => {
  const final = estadoValido();
  final.numero = "  ";
  final.valorTotal = null;
  final.vigenciaInicio = null;
  final.partes[1].documento = null;
  final.dotacoes[0].unidadeCodigo = "";

  const pendentes = listarCamposPendentes(final);
  assert.ok(pendentes.includes("Número do contrato"));
  assert.ok(pendentes.includes("Valor total"));
  assert.ok(pendentes.includes("Vigência – início"));
  assert.ok(pendentes.includes("Contratado – documento"));
  assert.ok(pendentes.includes("Dotação 1 – código da unidade"));

  assert.throws(() => validarParaConfirmacao(final), ValidationError);
});

test("zero em quantidade/valores de item conta como pendente", () => {
  const final = estadoValido();
  final.itens[0].quantidade = 0;
  final.itens[0].valorUnitario = 0;
  final.itens[0].valorTotal = 0;

  const pendentes = listarCamposPendentes(final);
  assert.ok(pendentes.includes("Item 1 – quantidade"));
  assert.ok(pendentes.includes("Item 1 – valor unitário"));
  assert.ok(pendentes.includes("Item 1 – valor total"));
});

test("listas vazias de itens/dotações bloqueiam a confirmação", () => {
  const final = estadoValido();
  final.itens = [];
  final.dotacoes = [];

  const pendentes = listarCamposPendentes(final);
  assert.ok(pendentes.includes("Itens (ao menos um)"));
  assert.ok(pendentes.includes("Dotações (ao menos uma)"));
});

test("divergência entre soma dos itens e valor total bloqueia a confirmação", () => {
  const final = estadoValido();
  final.valorTotal = 99.9;

  assert.equal(calcularConferenciaItens(final.itens, final.valorTotal), false);
  assert.throws(
    () => validarParaConfirmacao(final),
    (erro: unknown) =>
      erro instanceof ValidationError && /soma dos itens não confere/.test(erro.message),
  );
});

test("diferença de 1 centavo é aceita como conferência (arredondamento)", () => {
  const final = estadoValido();
  final.valorTotal = 100.01;

  assert.equal(calcularConferenciaItens(final.itens, final.valorTotal), true);
});
