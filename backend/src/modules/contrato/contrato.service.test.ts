import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DuplicateContratoError, ContratoNaoExcluivelError, NotFoundError } from "../../common/errors";
import { ContratoService } from "./contrato.service";

/**
 * Reimportar o mesmo PDF já não pode virar 500 (P2002 em `numero`): o service
 * identifica o contrato existente e responde 409 com instrução de exclusão.
 */
const GOLDEN = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "parsing",
  "src",
  "services",
  "__fixtures__",
  "contrato_dv00014_2026.extracted.json",
);

const extracao = () => JSON.parse(readFileSync(GOLDEN, "utf8"));

function criarService(opcoes: { existente: boolean }) {
  const chamadas = { importar: 0 };

  const repository = {
    findByNumero: async (numero: string) => (opcoes.existente ? { id: 7, numero } : null),
    importar: async (input: { data: { numero: string } }) => {
      chamadas.importar += 1;
      return { id: 1, numero: input.data.numero, status: "RASCUNHO" };
    },
  };

  const parsing = {
    importarDocumento: async () => ({ contrato: extracao(), avisos: ["extração ok"] }),
  };

  return {
    service: new ContratoService(repository as any, parsing as any),
    chamadas,
  };
}

test("reimportar contrato com o mesmo número responde conflito sem persistir", async () => {
  const { service, chamadas } = criarService({ existente: true });

  await assert.rejects(
    () => service.importarArquivo(Buffer.from(""), "contrato.pdf"),
    (erro: unknown) => erro instanceof DuplicateContratoError && erro.statusCode === 409,
  );
  assert.equal(chamadas.importar, 0);
});

test("importação inédita persiste como RASCUNHO e devolve os avisos do parsing", async () => {
  const { service, chamadas } = criarService({ existente: false });

  const resultado = await service.importarArquivo(Buffer.from(""), "contrato.pdf");

  assert.equal(chamadas.importar, 1);
  assert.equal(resultado.numero, "00141/2026-SDC");
  assert.equal(resultado.status, "RASCUNHO");
  assert.deepEqual(resultado.avisos, ["extração ok"]);
});

function criarServiceDelete(status: string | null) {
  const chamadas = { delete: 0 };

  const repository = {
    findById: async () => (status ? { id: 5, status } : null),
    delete: async () => {
      chamadas.delete += 1;
    },
  };

  return {
    service: new ContratoService(repository as any, {} as any),
    chamadas,
  };
}

test("exclusão: rascunho (importado e não confirmado) pode ser descartado", async () => {
  const { service, chamadas } = criarServiceDelete("RASCUNHO");

  await service.delete(5);

  assert.equal(chamadas.delete, 1);
});

test("exclusão: contrato salvo/confirmado não pode ser excluído", async () => {
  for (const status of ["ATIVA", "EM_ADITAMENTO", "ENCERRADA", "VENCIDA"]) {
    const { service, chamadas } = criarServiceDelete(status);

    await assert.rejects(
      () => service.delete(5),
      (erro: unknown) => erro instanceof ContratoNaoExcluivelError && erro.statusCode === 409,
    );
    assert.equal(chamadas.delete, 0, `status ${status} não deveria excluir`);
  }
});

test("exclusão: contrato inexistente responde 404", async () => {
  const { service, chamadas } = criarServiceDelete(null);

  await assert.rejects(
    () => service.delete(5),
    (erro: unknown) => erro instanceof NotFoundError && erro.statusCode === 404,
  );
  assert.equal(chamadas.delete, 0);
});
