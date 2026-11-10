import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DuplicateContratoError } from "../../common/errors";
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
