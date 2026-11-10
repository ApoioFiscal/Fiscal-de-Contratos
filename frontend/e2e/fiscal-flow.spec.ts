import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// Os testes compartilham a fixture criada no beforeAll e o contrato semeado.
test.describe.configure({ mode: "serial" });

const API = "/api";
const EMAIL_ADMIN = "admin@marizopolis.gov.br";
const EMAIL_SAUDE = "saude@marizopolis.gov.br";
const SIGLA_SAUDE = "SAUDE";
const NUMERO_CONTRATO = "00141/2026-SDC";

async function logar(page: Page, email: string, senha = "123456") {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("aside nav")).toBeVisible();
}

const nav = (page: Page) => page.locator("aside nav");
const itemNav = (page: Page, label: string) => nav(page).getByText(label, { exact: true });

async function selecionarContrato(page: Page, aria: string) {
  await page.getByLabel(aria).selectOption({ index: 1 });
}

async function tokenAdmin(request: APIRequestContext): Promise<string> {
  const resposta = await request.post(`${API}/usuarios/login`, {
    data: { email: EMAIL_ADMIN, senha: "123456" },
  });
  expect(resposta.status(), await resposta.text()).toBe(200);
  return (await resposta.json()).data as string;
}

// O seed de desenvolvimento não cria mais a Secretaria de Saúde: o E2E cria a
// fixture (setor SAUDE + usuário saude@ + vínculo com o contrato de exemplo).
async function garantirFixtureSaude(request: APIRequestContext) {
  const token = await tokenAdmin(request);
  const headers = { Authorization: `Bearer ${token}` };

  const setoresResp = await request.get(`${API}/setores`, { headers });
  expect(setoresResp.ok(), await setoresResp.text()).toBeTruthy();
  const setores: any[] = (await setoresResp.json()).data;

  let setorSaude = setores.find((s) => String(s.sigla).toUpperCase() === SIGLA_SAUDE);

  if (!setorSaude) {
    const criarSetor = await request.post(`${API}/setores`, {
      headers,
      data: {
        nome: "Secretaria Municipal de Saúde",
        sigla: SIGLA_SAUDE,
        tipo: "SECRETARIA",
      },
    });
    expect(criarSetor.ok(), await criarSetor.text()).toBeTruthy();
    setorSaude = (await criarSetor.json()).data;
  }

  const usuariosResp = await request.get(`${API}/usuarios`, { headers });
  expect(usuariosResp.ok(), await usuariosResp.text()).toBeTruthy();
  const usuarios: any[] = (await usuariosResp.json()).data;

  if (!usuarios.some((u) => u.email === EMAIL_SAUDE)) {
    const criarUsuario = await request.post(`${API}/usuarios`, {
      headers,
      data: {
        nome: "Secretaria de Saúde",
        email: EMAIL_SAUDE,
        senha: "123456",
        funcao: "SECRETARIO",
        idSetor: setorSaude.id,
      },
    });
    expect(criarUsuario.ok(), await criarUsuario.text()).toBeTruthy();
  }

  const contratosResp = await request.get(`${API}/contratos`, { headers });
  expect(contratosResp.ok(), await contratosResp.text()).toBeTruthy();
  const contratos: any[] = (await contratosResp.json()).data;
  const contrato = contratos.find((c) => c.numero === NUMERO_CONTRATO);
  expect(contrato, `contrato semeado ${NUMERO_CONTRATO}`).toBeTruthy();

  // PATCH /contratos/:id substitui a lista de vínculos: reenvia os existentes
  // preservando a origem e acrescenta a SAUDE.
  const vinculos = new Map<number, "DOTACAO" | "MANUAL">();
  for (const vinculo of contrato.setores ?? []) {
    vinculos.set(vinculo.idSetor, vinculo.origem ?? "MANUAL");
  }
  vinculos.set(setorSaude.id, "MANUAL");

  const patch = await request.patch(`${API}/contratos/${contrato.id}`, {
    headers,
    data: {
      setores: [...vinculos.entries()].map(([idSetor, origem]) => ({ idSetor, origem })),
    },
  });
  expect(patch.ok(), await patch.text()).toBeTruthy();
}

test.beforeAll(async ({ request }) => {
  await garantirFixtureSaude(request);
});

test.describe("Secretaria (saude@marizopolis.gov.br)", () => {
  test("redireciona para o Dashboard e não acessa Estoque/Avaliações", async ({ page }) => {
    await logar(page, EMAIL_SAUDE);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /^Visão Geral/ })).toBeVisible();
    await expect(itemNav(page, "Dashboard")).toBeVisible();
    await expect(itemNav(page, "Pedidos e Ordens")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("vê os pedidos do seu setor e abre o modal de novo pedido", async ({ page }) => {
    await logar(page, EMAIL_SAUDE);
    await page.goto("/pedidos");
    await page.getByRole("button", { name: "Novo Pedido" }).click();
    await expect(page.getByRole("dialog", { name: "Novo Pedido" })).toBeVisible();
    await selecionarContrato(page, "Contrato do pedido");
    await expect(page.getByText("Itens Disponíveis")).toBeVisible();
    await expect(page.getByText("PLACA EM ACM").first()).toBeVisible();
  });

  test("cria um novo pedido de ponta a ponta", async ({ page }) => {
    await logar(page, EMAIL_SAUDE);
    await page.goto("/pedidos");
    const antes = await page.getByText(/^REQ-\d+$/).count();
    await page.getByRole("button", { name: "Novo Pedido" }).click();
    await selecionarContrato(page, "Contrato do pedido");
    await expect(page.getByText("Itens Disponíveis")).toBeVisible();
    await page.getByRole("dialog", { name: "Novo Pedido" }).locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: "Criar Pedido" }).click();
    await expect(page.getByRole("dialog", { name: "Novo Pedido" })).toHaveCount(0);
    await expect(page.getByText(/^REQ-\d+$/)).toHaveCount(antes + 1);
  });
});

test.describe("Secretaria de Licitações (lic@marizopolis.gov.br)", () => {
  test("redireciona para /contratos e vê o contrato 00141/2026-SDC", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await expect(page).toHaveURL("/contratos");
    await expect(page.getByText(NUMERO_CONTRATO)).toBeVisible();
    await expect(itemNav(page, "Renovacoes")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("fila de pedidos somente leitura (sem ações de status)", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText(/Solicitações do seu setor/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Compra" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Novo Pedido" })).toHaveCount(0);
  });

  test("acompanha termos de renovação e não pode emitir", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await page.goto("/renovacoes");
    await expect(page.getByRole("heading", { name: "Termos de Renovação" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Solicitar Termo" })).toHaveCount(0);
  });

  test("revisa os dados do contrato em rascunho na barra lateral", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await page.goto("/contratos");

    await page.getByText(NUMERO_CONTRATO).first().click();
    await page.getByRole("button", { name: "Revisar dados" }).click();

    const drawer = page.getByRole("dialog", { name: `Revisar contrato ${NUMERO_CONTRATO}` });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Dados gerais")).toBeVisible();

    // A lista de itens precisa renderizar (o total sugerido usa a conversão
    // numérica dos campos). Regressão: um helper `numero()` sombreado pelo
    // estado `numero` quebrava a barra lateral com "is not a function".
    await expect(drawer.getByText(/Sugerido \(qtd × unitário\)/).first()).toBeVisible();

    // O seed do E2E não cria signatários; a revisão manual serve justamente para
    // preencher o que o OCR não trouxe. Se já houver testemunha, só corrige o nome.
    const nomeTestemunha = drawer.getByLabel("Nome da testemunha 1");
    if ((await nomeTestemunha.count()) === 0) {
      await drawer.getByRole("button", { name: "Adicionar signatário" }).click();
    }
    await drawer.getByLabel("Nome da testemunha 1").fill("Maria Testemunha E2E");

    await drawer.getByRole("button", { name: "Salvar revisão" }).click();
    await expect(drawer).toHaveCount(0);
  });
});

test.describe("Compras (compras@marizopolis.gov.br)", () => {
  test("acessa a fila de compras e não vê Estoque/Avaliações", async ({ page }) => {
    await logar(page, "compras@marizopolis.gov.br");
    await expect(page).toHaveURL("/");
    await expect(itemNav(page, "Dashboard")).toBeVisible();
    await expect(itemNav(page, "Contratos")).toBeVisible();
    await expect(itemNav(page, "Pedidos e Ordens")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("opera a fila (registra compra) e não cria pedido", async ({ page }) => {
    await logar(page, "compras@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText(/Fila de compras/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Todos \(/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo Pedido" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Conferir e Concluir" })).toHaveCount(0);
  });

  test("vê Contratos em leitura (sem confirmar revisão)", async ({ page }) => {
    await logar(page, "compras@marizopolis.gov.br");
    await page.goto("/contratos");
    await expect(page.getByText(NUMERO_CONTRATO)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar Revisão" })).toHaveCount(0);
  });
});

test.describe("Fiscalização de Contratos (fcon@marizopolis.gov.br)", () => {
  test("acessa todas as áreas operacionais", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await expect(page).toHaveURL("/");
    await expect(itemNav(page, "Estoque")).toBeVisible();
    await expect(itemNav(page, "Avaliacoes")).toBeVisible();
    await expect(itemNav(page, "Renovacoes")).toBeVisible();
  });

  test("recebe apenas os pedidos entregues, sem as etapas do Compras", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText(/Pedidos entregues pelo Compras aguardando conferência/)).toBeVisible();
    // As etapas do pedido pertencem à tela do Compras.
    await expect(page.getByRole("button", { name: /^Todos \(/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Registrar Compra/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Compra Efetuada/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Informar Chegada/ })).toHaveCount(0);
    // Filtros de gestão também ficam no Compras; sobra apenas a busca.
    await expect(page.getByLabel("Filtrar por secretaria")).toHaveCount(0);
    await expect(page.getByLabel("Ordenar pedidos")).toHaveCount(0);
    // Histórico do que já foi conferido fica disponível para reimprimir o termo.
    await expect(page.getByRole("button", { name: /Conferidos recentemente/ })).toBeVisible();
  });

  test("visualiza saldos de estoque do contrato", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/estoque");
    await selecionarContrato(page, "Contrato do estoque");
    await expect(page.getByText("PLACA EM ACM").first()).toBeVisible();
    await expect(page.getByText("PVC EXPANDIDO 10 MM").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrada de Nota" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dar Baixa" })).toBeVisible();
  });

  test("visualiza avaliações e resumo do fornecedor", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/avaliacoes");
    await selecionarContrato(page, "Contrato da avaliacao");
    await expect(page.getByText("Resumo do Fornecedor")).toBeVisible();
    await expect(page.getByText(/avaliações registradas neste contrato/)).toBeVisible();
    await expect(page.getByText("Entregas com Problema")).toBeVisible();
  });

  test("visualiza termos de renovação sem permissão de emitir", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/renovacoes");
    await expect(page.getByRole("heading", { name: "Termos de Renovação" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Solicitar Termo" })).toHaveCount(0);
  });
});
