import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { existsSync, promises as fs } from "node:fs";
import { StatusPedido } from "@prisma/client";
import { PedidoService } from "./pedido.service";
import { PedidoRepository } from "./pedido.repository";
import { GeradorTermoRecebimentoDocx } from "./geradorTermoRecebimento";
import { normalizarSigla, gerarNumeroOrdem } from "./pedidoUtils";
import { ValidationError, NotFoundError } from "../../common/errors";

// ---------------------------------------------------------------------------
// Fixtures e fakes (sem banco de dados)
// ---------------------------------------------------------------------------

interface RegistroStatus {
  id: number;
  status: StatusPedido;
  input: { status: StatusPedido; numeroOrdem?: string; aviso?: string; cpf?: string; observacao?: string };
  idUsuario: number;
  arquivoTermo?: string;
}

function pedidoFixture(status: StatusPedido) {
  return {
    id: 1,
    numeroPedido: "REQ-001",
    status,
    idSetorCriador: 2,
    setor: { id: 2, nome: "Secretaria de Saúde", sigla: "SAÚDE" },
    contrato: { id: 1, numero: "LIC-2026-001" },
    itens: [
      {
        id: 11,
        idItemLicitado: 100,
        quantidade: 10,
        valorUnitario: 5,
        valorTotal: 50,
        itemLicitado: { id: 100, descricao: "Dipirona 500mg", unidade: "UN" },
      },
    ],
  };
}

function criarRepoFake(opcoes: { pedido?: unknown; ordensPorSetor?: number } = {}) {
  const chamadas = { countOrdens: 0, updateStatus: [] as RegistroStatus[] };
  const repo = {
    async findById() {
      return opcoes.pedido ?? null;
    },
    async countOrdensPorSetor() {
      chamadas.countOrdens += 1;
      return opcoes.ordensPorSetor ?? 0;
    },
    async updateStatus(
      id: number,
      status: StatusPedido,
      input: RegistroStatus["input"],
      idUsuario: number,
      arquivoTermo?: string
    ) {
      chamadas.updateStatus.push({ id, status, input, idUsuario, arquivoTermo });
      return { id, status };
    },
  } as unknown as PedidoRepository;
  return { repo, chamadas };
}

// ---------------------------------------------------------------------------
// Lógica pura da Ordem de Compra
// ---------------------------------------------------------------------------

test("normaliza a sigla do setor para a Ordem de Compra", () => {
  assert.equal(normalizarSigla("SAÚDE"), "SAUDE");
  assert.equal(normalizarSigla("Séc. Obras"), "SECOBRAS");
  assert.equal(normalizarSigla(""), "SEC");
  assert.equal(normalizarSigla(undefined), "SEC");
  assert.equal(normalizarSigla(null), "SEC");
});

test("gera numero da ordem de compra com sigla e sequencia em 3 digitos", () => {
  assert.equal(gerarNumeroOrdem("SAÚDE", 1), "OC-SAUDE-001");
  assert.equal(gerarNumeroOrdem("SAUDE", 12), "OC-SAUDE-012");
  assert.equal(gerarNumeroOrdem(null, 7), "OC-SEC-007");
  assert.equal(gerarNumeroOrdem(undefined, 120), "OC-SEC-120");
});

// ---------------------------------------------------------------------------
// PedidoService.atualizarStatus
// ---------------------------------------------------------------------------

test("CONFIRMADO gera ordem de compra automaticamente (sequencia por setor)", async () => {
  const { repo, chamadas } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.PENDENTE) });
  const service = new PedidoService(repo);

  await service.atualizarStatus(1, { id: 10, nome: "Fiscal" }, { status: StatusPedido.CONFIRMADO });

  assert.equal(chamadas.countOrdens, 1);
  assert.equal(chamadas.updateStatus.length, 1);
  assert.equal(chamadas.updateStatus[0].status, StatusPedido.CONFIRMADO);
  assert.equal(chamadas.updateStatus[0].input.numeroOrdem, "OC-SAUDE-001");
  assert.equal(chamadas.updateStatus[0].idUsuario, 10);
});

test("CONFIRMADO respeita o contador de ordens ja emitidas do setor", async () => {
  const { repo, chamadas } = criarRepoFake({
    pedido: pedidoFixture(StatusPedido.PENDENTE),
    ordensPorSetor: 7,
  });
  const service = new PedidoService(repo);

  await service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.CONFIRMADO });

  assert.equal(chamadas.updateStatus[0].input.numeroOrdem, "OC-SAUDE-008");
});

test("transicao invalida de status gera ValidationError", async () => {
  const { repo } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.PENDENTE) });
  const service = new PedidoService(repo);

  await assert.rejects(
    () => service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.CONCLUIDO }),
    (err: unknown) => err instanceof ValidationError && /Transição inválida/.test((err as Error).message)
  );
});

test("CONFIRMADO permite marcar compra efetuada (sem numero de ordem manual)", async () => {
  const { repo, chamadas } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.CONFIRMADO) });
  const service = new PedidoService(repo);

  await service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.EFETUADO });

  assert.equal(chamadas.updateStatus.length, 1);
  assert.equal(chamadas.updateStatus[0].status, StatusPedido.EFETUADO);
  assert.equal(chamadas.updateStatus[0].input.numeroOrdem, undefined);
});

test("EFETUADO permite registrar entrega (vai para ENTREGUE) sem gerar termo", async () => {
  const { repo, chamadas } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.EFETUADO) });
  const service = new PedidoService(repo);

  await service.atualizarStatus(
    1,
    { id: 10, nome: "Fiscal" },
    { status: StatusPedido.ENTREGUE, observacao: "Entrega parcial, faltou 1 caixa" }
  );

  assert.equal(chamadas.updateStatus.length, 1);
  assert.equal(chamadas.updateStatus[0].status, StatusPedido.ENTREGUE);
  assert.equal(chamadas.updateStatus[0].input.observacao, "Entrega parcial, faltou 1 caixa");
  assert.equal(chamadas.updateStatus[0].arquivoTermo, undefined);
});

test("EFETUADO nao permite concluir direto (CONCLUIDO so a partir de ENTREGUE)", async () => {
  const { repo } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.EFETUADO) });
  const service = new PedidoService(repo);

  await assert.rejects(
    () => service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.CONCLUIDO }),
    (err: unknown) => err instanceof ValidationError && /Transição inválida/.test((err as Error).message)
  );
  await assert.rejects(
    () => service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.DEVOLVIDO }),
    (err: unknown) => err instanceof ValidationError && /Transição inválida/.test((err as Error).message)
  );
});

test("ENTREGUE permite concluir (gera termo) com CPF valido", async () => {
  const { repo, chamadas } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.ENTREGUE) });
  const geradorFake = { gerar: async () => Buffer.from("fake-docx") } as unknown as GeradorTermoRecebimentoDocx;
  const service = new PedidoService(repo, geradorFake);

  const arquivo = path.join(process.cwd(), "uploads", "termos", "TERMO-RECEBIMENTO-REQ-001.docx");
  try {
    await service.atualizarStatus(
      1,
      { id: 10, nome: "Fiscal de Teste" },
      { status: StatusPedido.CONCLUIDO, cpf: "529.982.247-25" }
    );

    assert.equal(chamadas.updateStatus.length, 1);
    assert.equal(chamadas.updateStatus[0].status, StatusPedido.CONCLUIDO);
    assert.equal(chamadas.updateStatus[0].arquivoTermo, "TERMO-RECEBIMENTO-REQ-001.docx");
  } finally {
    await fs.rm(arquivo, { force: true });
  }
});

test("ENTREGUE permite devolver ou cancelar o pedido", async () => {
  const { repo, chamadas } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.ENTREGUE) });
  const service = new PedidoService(repo);

  await service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.DEVOLVIDO });
  await service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.CANCELADO });

  assert.equal(chamadas.updateStatus.length, 2);
  assert.equal(chamadas.updateStatus[0].status, StatusPedido.DEVOLVIDO);
  assert.equal(chamadas.updateStatus[1].status, StatusPedido.CANCELADO);
});

test("pedido ja no status informado gera ValidationError", async () => {
  const { repo } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.PENDENTE) });
  const service = new PedidoService(repo);

  await assert.rejects(
    () => service.atualizarStatus(1, { id: 10 }, { status: StatusPedido.PENDENTE }),
    (err: unknown) => err instanceof ValidationError && /já está pendente/.test((err as Error).message)
  );
});

test("pedido inexistente gera NotFoundError antes de transicionar", async () => {
  const { repo } = criarRepoFake();
  const service = new PedidoService(repo);

  await assert.rejects(
    () => service.atualizarStatus(999, { id: 10 }, { status: StatusPedido.CONFIRMADO }),
    (err: unknown) => err instanceof NotFoundError
  );
  await assert.rejects(
    () => service.obterArquivoTermo(999),
    (err: unknown) => err instanceof NotFoundError
  );
});

test("CONCLUIDO sem CPF valido gera ValidationError e nao persiste termo", async () => {
  const { repo, chamadas } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.ENTREGUE) });
  const service = new PedidoService(repo);

  await assert.rejects(
    () => service.atualizarStatus(1, { id: 10, nome: "Fiscal" }, { status: StatusPedido.CONCLUIDO }),
    (err: unknown) => err instanceof ValidationError && /CPF/.test((err as Error).message)
  );
  await assert.rejects(
    () =>
      service.atualizarStatus(1, { id: 10, nome: "Fiscal" }, { status: StatusPedido.CONCLUIDO, cpf: "123" }),
    (err: unknown) => err instanceof ValidationError && /CPF/.test((err as Error).message)
  );

  assert.equal(chamadas.updateStatus.length, 0);
});

test("CONCLUIDO com CPF valido gera e persiste o termo de recebimento", async () => {
  const termosDir = path.join(process.cwd(), "uploads", "termos");
  const arquivo = path.join(termosDir, "TERMO-RECEBIMENTO-REQ-001.docx");
  const geradorFake = {
    gerar: async () => Buffer.from("fake-docx"),
  } as unknown as GeradorTermoRecebimentoDocx;

  try {
    const { repo, chamadas } = criarRepoFake({ pedido: pedidoFixture(StatusPedido.ENTREGUE) });
    const service = new PedidoService(repo, geradorFake);

    await service.atualizarStatus(
      1,
      { id: 10, nome: "Fiscal de Teste" },
      { status: StatusPedido.CONCLUIDO, cpf: "529.982.247-25" }
    );

    assert.equal(chamadas.updateStatus.length, 1);
    assert.equal(chamadas.updateStatus[0].status, StatusPedido.CONCLUIDO);
    assert.equal(chamadas.updateStatus[0].arquivoTermo, "TERMO-RECEBIMENTO-REQ-001.docx");

    assert.equal(existsSync(arquivo), true, "arquivo do termo deve existir em uploads/termos");
    const conteudo = await fs.readFile(arquivo, "utf8");
    assert.equal(conteudo, "fake-docx");
  } finally {
    await fs.rm(arquivo, { force: true });
  }
});

test("obterArquivoTermo falha quando termo ainda nao foi gerado", async () => {
  const { repo } = criarRepoFake({
    pedido: { ...pedidoFixture(StatusPedido.ENTREGUE), arquivoTermo: null },
  });
  const service = new PedidoService(repo);

  await assert.rejects(
    () => service.obterArquivoTermo(1),
    (err: unknown) => err instanceof NotFoundError && /Termo de recebimento/.test((err as Error).message)
  );
});

test("obterArquivoTermo retorna o caminho do arquivo salvo", async () => {
  const { repo } = criarRepoFake({
    pedido: { ...pedidoFixture(StatusPedido.CONCLUIDO), arquivoTermo: "TERMO-RECEBIMENTO-REQ-001.docx" },
  });
  const service = new PedidoService(repo);

  // O arquivo existe? Criamos um placeholder só para o teste de caminho não
  // ser bloqueado pelo existsSync.
  const caminho = path.join(process.cwd(), "uploads", "termos", "TERMO-RECEBIMENTO-REQ-001.docx");
  const zero = Buffer.alloc(0);
  try {
    await fs.mkdir(path.dirname(caminho), { recursive: true });
    await fs.writeFile(caminho, zero);
    const { caminho: obtido, filename } = await service.obterArquivoTermo(1);
    assert.equal(filename, "TERMO-RECEBIMENTO-REQ-001.docx");
    assert.equal(obtido, caminho);
  } finally {
    await fs.rm(caminho, { force: true });
  }
});

// ---------------------------------------------------------------------------
// Gerador do documento do termo (DOCX)
// ---------------------------------------------------------------------------

test("gerador do termo produz um pacote DOCX valido", async () => {
  const gerador = new GeradorTermoRecebimentoDocx();
  const buffer = await gerador.gerar(
    {
      numeroPedido: "REQ-001",
      contrato: { numero: "LIC-2026-001" },
      setor: { nome: "Secretaria de Saúde" },
      itens: [
        {
          idItemLicitado: 100,
          quantidade: 10,
          valorUnitario: 5,
          valorTotal: 50,
          itemLicitado: { descricao: "Dipirona 500mg", marca: "Genérico", unidade: "UN" },
        },
      ],
    },
    "Fiscal de Teste",
    "123.456.789-00"
  );

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000, "docx deve ter conteudo");
  assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK", "deve ser um zip valido");

  const texto = buffer.toString("latin1");
  assert.ok(texto.includes("[Content_Types].xml"));
  assert.ok(texto.includes("word/document.xml"));
});