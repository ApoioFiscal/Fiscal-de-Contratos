import assert from "node:assert/strict";
import test from "node:test";
import { SetorService } from "./setor.service";
import { SetorRepository } from "./setor.repository";
import { ForbiddenError, NotFoundError, ValidationError } from "../../common/errors";

const setorBase = {
  id: 10,
  nome: "Secretaria de Saúde",
  sigla: "SAUDE",
  tipo: "SECRETARIA" as const,
  responsavel: null,
  descricao: null,
  idSetor: null,
  criadoEm: new Date("2026-01-01"),
  atualizadoEm: new Date("2026-01-01"),
};

function criarService(
  opcoes: {
    setor?: typeof setorBase | null;
    vinculos?: { usuarios?: number; pedidos?: number; termosRenovacao?: number; subSetores?: number };
  } = {}
) {
  const chamadas = { deleted: [] as number[] };
  const vinculos = {
    usuarios: 0,
    pedidos: 0,
    termosRenovacao: 0,
    subSetores: 0,
    ...opcoes.vinculos,
  };

  const repository = {
    async findById() {
      return opcoes.setor === undefined ? setorBase : opcoes.setor;
    },
    async findBySigla() {
      return null;
    },
    async contarVinculos() {
      return vinculos;
    },
    async deleteById(id: number) {
      chamadas.deleted.push(id);
      return setorBase;
    },
  };

  const service = new SetorService(repository as unknown as SetorRepository);
  return { service, chamadas };
}

test("deleteById: bloqueia setores raízes (GAB, LIC, FCON, CMP)", async () => {
  for (const sigla of ["GAB", "LIC", "FCON", "CMP"]) {
    const { service, chamadas } = criarService({ setor: { ...setorBase, sigla } });

    await assert.rejects(() => service.deleteById(10), ForbiddenError);
    assert.deepEqual(chamadas.deleted, [], `setor ${sigla} não deveria ser excluído`);
  }
});

test("deleteById: reconhece setor raiz mesmo com variações de caixa/acento", async () => {
  const { service } = criarService({ setor: { ...setorBase, sigla: "fcon" } });

  await assert.rejects(() => service.deleteById(10), ForbiddenError);
});

test("deleteById: recusa quando há usuários vinculados", async () => {
  const { service, chamadas } = criarService({ vinculos: { usuarios: 2 } });

  await assert.rejects(
    () => service.deleteById(10),
    (erro: any) => erro instanceof ValidationError && /2 usuário\(s\)/.test(erro.message)
  );
  assert.deepEqual(chamadas.deleted, []);
});

test("deleteById: recusa quando há pedidos vinculados", async () => {
  const { service } = criarService({ vinculos: { pedidos: 1 } });

  await assert.rejects(() => service.deleteById(10), ValidationError);
});

test("deleteById: exclui uma secretaria sem vínculos (limpando contrato_setor)", async () => {
  const { service, chamadas } = criarService();

  await service.deleteById(10);

  assert.deepEqual(chamadas.deleted, [10]);
});

test("deleteById: setor inexistente gera NotFoundError", async () => {
  const { service } = criarService({ setor: null });

  await assert.rejects(() => service.deleteById(10), NotFoundError);
});
