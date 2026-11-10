import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import { UsuarioService } from "./usuario.service";
import { UsuarioRepository } from "./usuario.repository";
import { SetorRepository } from "../setor/setor.repository";
import { DuplicateEmailError, NotFoundError } from "../../common/errors";
import type { UpdateUsuarioInput } from "../../common/schemas";

// ---------------------------------------------------------------------------
// Fakes (sem banco de dados)
// ---------------------------------------------------------------------------

const usuarioExistente = {
  id: 7,
  nome: "Fulano de Tal",
  email: "fulano@marizopolis.gov.br",
  funcao: "SECRETARIO" as const,
  isAdmin: false,
  criadoEm: new Date("2026-01-01"),
  setor: { id: 2, nome: "Secretaria de Saúde", sigla: "SAUDE" },
};

function criarService(opcoes: { usuario?: unknown; setorExiste?: boolean } = {}) {
  const chamadas = {
    upd: [] as Array<{ id: number; data: Record<string, unknown> }>,
    emailsConsultados: [] as string[],
  };

  const usuarioRepository = {
    async findById() {
      return opcoes.usuario ?? null;
    },
    async findByEmail(email: string) {
      chamadas.emailsConsultados.push(email);
      // Simula outro usuário já cadastrado com o e-mail informado
      if (email === "outro@marizopolis.gov.br") {
        return { ...usuarioExistente, id: 99, email };
      }
      if (email === usuarioExistente.email) {
        return usuarioExistente;
      }
      return null;
    },
    async update(id: number, data: Record<string, unknown>) {
      chamadas.upd.push({ id, data });
      return { ...usuarioExistente, ...data, setor: usuarioExistente.setor };
    },
  };

  const setorRepository = {
    async findById() {
      return opcoes.setorExiste === false ? null : { id: 2, nome: "Saúde", sigla: "SAUDE" };
    },
  };

  const service = new UsuarioService(
    usuarioRepository as unknown as UsuarioRepository,
    setorRepository as unknown as SetorRepository
  );

  return { service, chamadas };
}

function input(data: UpdateUsuarioInput): UpdateUsuarioInput {
  return data;
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test("update: gera hash da senha quando ela é enviada", async () => {
  const { service, chamadas } = criarService({ usuario: usuarioExistente });

  await service.update(7, input({ senha: "nova-senha-123" }));

  const { data } = chamadas.upd[0];
  assert.equal(chamadas.upd[0].id, 7);
  assert.notEqual(data.senha, "nova-senha-123");
  assert.equal(await bcrypt.compare("nova-senha-123", String(data.senha)), true);
});

test("update: mantém a senha atual quando nenhuma senha é enviada", async () => {
  const { service, chamadas } = criarService({ usuario: usuarioExistente });

  await service.update(7, input({ nome: "Novo Nome", email: "novo@marizopolis.gov.br" }));

  const { data } = chamadas.upd[0];
  assert.equal(data.nome, "Novo Nome");
  assert.equal(data.email, "novo@marizopolis.gov.br");
  assert.equal("senha" in data, false);
});

test("update: trata senha vazia como 'não alterar'", async () => {
  const { service, chamadas } = criarService({ usuario: usuarioExistente });

  await service.update(7, input({ senha: "" }));

  assert.equal("senha" in chamadas.upd[0].data, false);
});

test("update: normaliza o e-mail (trim + minúsculas)", async () => {
  const { service, chamadas } = criarService({ usuario: usuarioExistente });

  await service.update(7, input({ email: "  Novo.Email@Marizopolis.GOV.BR " }));

  assert.equal(chamadas.upd[0].data.email, "novo.email@marizopolis.gov.br");
});

test("update: rejeita e-mail já usado por outro usuário", async () => {
  const { service, chamadas } = criarService({ usuario: usuarioExistente });

  await assert.rejects(
    () => service.update(7, input({ email: "outro@marizopolis.gov.br" })),
    DuplicateEmailError
  );
  assert.equal(chamadas.upd.length, 0);
});

test("update: permite manter o próprio e-mail", async () => {
  const { service, chamadas } = criarService({ usuario: usuarioExistente });

  await service.update(7, input({ email: usuarioExistente.email }));

  assert.equal(chamadas.emailsConsultados.length, 0);
  assert.equal(chamadas.upd[0].data.email, usuarioExistente.email);
});

test("update: rejeita usuário inexistente", async () => {
  const { service } = criarService({ usuario: null });

  await assert.rejects(() => service.update(7, input({ nome: "X" })), NotFoundError);
});

test("update: rejeita setor inexistente", async () => {
  const { service } = criarService({ usuario: usuarioExistente, setorExiste: false });

  await assert.rejects(() => service.update(7, input({ idSetor: 123 })), NotFoundError);
});
