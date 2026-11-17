import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { ContratoExtractionSchema, AtualizarContratoSchema } from "./contrato.schema";
import { mapearParaCriar } from "../modules/contrato/conversorContrato";

/**
 * Contrato entre os pacotes: o backend só aceita como contrato o que o extrator do
 * `parsing` produz. Este teste lê o golden file gerado do contrato real
 * (processo 260803DV00014) e exige que o schema continue aceitando a extração.
 *
 * Se o colega mudar a forma de `ContratoExtraction`, este teste quebra de propósito —
 * é melhor quebrar aqui do que dessincronizar em silêncio.
 */
const GOLDEN = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "parsing",
  "src",
  "services",
  "__fixtures__",
  "contrato_dv00014_2026.extracted.json",
);

test("golden do contrato real existe (monorepo)", () => {
  assert.ok(
    existsSync(GOLDEN),
    `Golden file não encontrado em ${GOLDEN}. O teste exige o repositório completo (backend + parsing).`,
  );
});

test("schema aceita a extração do contrato real sem alterar nenhum campo", () => {
  const raw = JSON.parse(readFileSync(GOLDEN, "utf8"));
  const parsed = ContratoExtractionSchema.parse(raw);

  // `parse` não pode descartar nada silenciosamente.
  assert.deepEqual(parsed, raw);

  // Escopo reduzido: nada de assinatura/signatários/condições/foro.
  for (const campo of [
    "assinatura",
    "signatarios",
    "condicoes",
    "fundamentacao_legal",
    "foro",
  ]) {
    assert.ok(!(campo in parsed), `O campo ${campo} não deve mais existir na extração`);
  }
  assert.ok(!("data_fim_calculada" in parsed.vigencia));
  assert.ok(!("trecho" in parsed.vigencia));
});

test("contrato real: dados que a tela de revisão usa estão presentes", () => {
  const contrato = ContratoExtractionSchema.parse(
    JSON.parse(readFileSync(GOLDEN, "utf8")),
  );

  assert.equal(contrato.numero_contrato, "00141/2026-SDC");
  assert.equal(contrato.numero_processo, "260803DV00014");
  assert.equal(contrato.contratante.nome, "Prefeitura Municipal de Marizópolis");
  assert.equal(contrato.contratante.documento, "01.612.941/0001-49");
  assert.equal(contrato.contratado.nome, "RENATA RODRIGUES LOURENCO DE ALMEIDA");
  assert.equal(contrato.contratado.documento, "35.848.636/0001-72");
  assert.equal(contrato.vigencia.data_inicio, "2026-08-19");
  assert.equal(contrato.vigencia.data_fim, "2026-12-31");
  assert.equal(contrato.valor_total, 37135);

  // 4 secretarias beneficiárias vêm das dotações.
  assert.deepEqual(
    contrato.dotacoes.map((d) => d.unidade),
    [
      "GABINETE DO PREFEITO",
      "SECRETARIA DE EDUCAÇÃO",
      "SECRETARIA DE SAUDE",
      "FUNDO MUNICIPAL DE ASSSITENCIA SOCIAL-FMAS",
    ],
  );

  // Quantidade fracionária (m²) precisa sobreviver como número, não ser truncada.
  assert.equal(contrato.itens[0].quantidade, 50);
  assert.ok(contrato.avisos.length >= 2);
});

test("mapeamento para o Prisma usa só nome/documento nas partes", () => {
  const contrato = ContratoExtractionSchema.parse(
    JSON.parse(readFileSync(GOLDEN, "utf8")),
  );

  const data = mapearParaCriar(contrato);

  assert.deepEqual(data.partes.create, [
    {
      papel: "CONTRATANTE",
      nome: "Prefeitura Municipal de Marizópolis",
      documento: "01.612.941/0001-49",
    },
    {
      papel: "CONTRATADO",
      nome: "RENATA RODRIGUES LOURENCO DE ALMEIDA",
      documento: "35.848.636/0001-72",
    },
  ]);
  assert.equal(data.itens.create.length, 5);
  assert.equal(data.dotacoes.create.length, 4);
  assert.ok(!("signatarios" in data));
});

test("schema rejeita contrato sem as partes (não inventa dados)", () => {
  const semPartes = {
    numero_contrato: "001/2026",
    numero_processo: null,
    modalidade: null,
    numero_modalidade: null,
    objeto: null,
    vigencia: {
      data_inicio: null,
      data_fim: null,
    },
    valor_total: null,
    itens: [],
    dotacoes: [],
    validacoes: {
      soma_itens_confere_total_da_tabela: null,
      soma_itens_confere_valor_do_contrato: null,
    },
    avisos: [],
  };

  assert.throws(() => ContratoExtractionSchema.parse(semPartes));
});

test("revisão aceita o payload camelCase devolvido pelo GET, com coleções", () => {
  const payload = {
    numero: "00141/2026-SDC",
    numeroProcesso: "260803DV00014",
    objeto: "Objeto corrigido à mão",
    valorTotal: 37135,
    vigenciaInicio: "2026-08-19",
    vigenciaFim: "2026-12-31",
    partes: [
      {
        papel: "CONTRATANTE",
        nome: "Prefeitura Municipal de Marizópolis",
        documento: "01.612.941/0001-49",
      },
    ],
    itens: [
      {
        id: 1,
        descricao: "PLACA EM ACM",
        unidade: "m²",
        quantidade: 50,
        valorUnitario: 289,
      },
    ],
    dotacoes: [
      {
        unidadeCodigo: "02",
        unidade: "SECRETARIA DE EDUCAÇÃO",
        funcionalProgramatica: "12.361.0002.2001",
      },
    ],
    confirmar: false,
  };

  const parsed = AtualizarContratoSchema.parse(payload);

  assert.equal(parsed.numero, "00141/2026-SDC");
  assert.equal(parsed.itens?.length, 1);
  assert.equal(parsed.itens?.[0].id, 1);
  assert.equal(parsed.partes?.[0].nome, "Prefeitura Municipal de Marizópolis");
  assert.equal(parsed.dotacoes?.[0].unidadeCodigo, "02");

  // Campos fora do escopo são ignorados silenciosamente pelo Zod (strictamente,
  // não são esperados no payload da nova tela de revisão).
  assert.ok(!("signatarios" in parsed));
  assert.ok(!("condicoes" in parsed));
});

test("revisão rejeita item sem descrição e data fora do formato", () => {
  assert.throws(() =>
    AtualizarContratoSchema.parse({
      itens: [{ descricao: "  ", unidade: "m²", quantidade: 1, valorUnitario: 10 }],
    }),
  );

  assert.throws(() => AtualizarContratoSchema.parse({ vigenciaInicio: "31/12/2026" }));
});
