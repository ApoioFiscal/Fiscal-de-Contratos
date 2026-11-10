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

test("golden do contrato real existe (monorepo)" , () => {
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
});

test("contrato real: dados que a tela de revisão usa estão presentes", () => {
  const contrato = ContratoExtractionSchema.parse(
    JSON.parse(readFileSync(GOLDEN, "utf8")),
  );

  assert.equal(contrato.numero_contrato, "00141/2026-SDC");
  assert.equal(contrato.numero_processo, "260803DV00014");
  assert.equal(contrato.contratante.documento, "01.612.941/0001-49");
  assert.equal(contrato.contratado.nome, "RENATA RODRIGUES LOURENCO DE ALMEIDA");
  assert.equal(contrato.contratado.documento, "35.848.636/0001-72");
  assert.equal(contrato.vigencia.data_fim, "2026-12-31");
  assert.equal(contrato.assinatura.data, "2026-08-19");
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

  // O que não foi lido com segurança fica null e vem acompanhado de aviso.
  assert.equal(contrato.signatarios[2].nome, null);
  assert.equal(contrato.signatarios[2].legivel, false);
  assert.ok(contrato.avisos.length >= 3);
});

test("mapeamento para o Prisma usa camelCase nos signatários", () => {
  const contrato = ContratoExtractionSchema.parse(
    JSON.parse(readFileSync(GOLDEN, "utf8")),
  );

  const data = mapearParaCriar(contrato);
  const signatarios = data.signatarios.create;

  assert.ok(signatarios.length > 0);
  for (const signatario of signatarios) {
    // Prisma rejeita `orgao_emissor_rg`/`estado_civil`/`confirmado_no_bloco_de_assinatura`;
    // esses campos precisam chegar como camelCase, senão o create quebra em runtime.
    assert.ok(!("orgao_emissor_rg" in signatario));
    assert.ok(!("estado_civil" in signatario));
    assert.ok(!("confirmado_no_bloco_de_assinatura" in signatario));
    assert.ok("orgaoEmissorRg" in signatario);
    assert.ok("estadoCivil" in signatario);
    assert.ok("confirmadoNoBloco" in signatario);
  }

  assert.equal(signatarios[0].orgaoEmissorRg, "SSP/PB");
  assert.equal(signatarios[1].confirmadoNoBloco, true);
});

test("schema rejeita contrato sem as partes (não inventa dados)", () => {
  const semPartes = {
    numero_contrato: "001/2026",
    numero_processo: null,
    modalidade: null,
    numero_modalidade: null,
    objeto: null,
    signatarios: [],
    assinatura: {
      local: null,
      data: null,
      assinatura_digital: { detectada: false, plataforma: null, assinante: null },
    },
    vigencia: {
      data_inicio: null,
      data_fim: null,
      data_fim_calculada: false,
      trecho: null,
    },
    valor_total: null,
    itens: [],
    dotacoes: [],
    condicoes: { prazo_execucao: null, prazo_pagamento: null, reajuste: null },
    fundamentacao_legal: [],
    foro: null,
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
    assinaturaData: "2026-08-19T00:00:00.000Z",
    assinaturaDigital: false,
    fundamentacaoLegal: ["Lei Federal nº 14.133/2021"],
    condicoes: {
      prazo_execucao: { quantidade: 15, unidade: "dias úteis", marco: "Ordem de Fornecimento" },
      prazo_pagamento: { quantidade: 30, unidade: "dias corridos" },
      reajuste: { prazo: "um ano", indice: "IPCA" },
    },
    partes: [
      {
        papel: "CONTRATANTE",
        nome: "Prefeitura Municipal de Marizópolis",
        documento: "01.612.941/0001-49",
        tipoDocumento: "CNPJ",
        representanteNome: "Prefeito",
      },
    ],
    signatarios: [
      {
        papel: "TESTEMUNHA",
        ordem: 2,
        nome: "Maria Testemunha",
        confirmadoNoBloco: false,
        legivel: true,
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
  assert.equal(parsed.partes?.[0].tipoDocumento, "CNPJ");
  assert.equal(parsed.signatarios?.[0].confirmadoNoBloco, false);
  assert.equal(parsed.condicoes?.prazo_execucao?.quantidade, 15);

  // `condicoes` pode ser limpo na revisão.
  assert.doesNotThrow(() => AtualizarContratoSchema.parse({ condicoes: null }));
});

test("revisão rejeita item sem descrição e data fora do formato", () => {
  assert.throws(() =>
    AtualizarContratoSchema.parse({
      itens: [{ descricao: "  ", unidade: "m²", quantidade: 1, valorUnitario: 10 }],
    }),
  );

  assert.throws(() => AtualizarContratoSchema.parse({ vigenciaInicio: "31/12/2026" }));
});

