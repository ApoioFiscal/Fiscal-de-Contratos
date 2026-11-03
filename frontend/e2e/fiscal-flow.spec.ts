import { test, expect, type Page } from "@playwright/test";

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

test.describe("Secretaria (saude@marizopolis.gov.br)", () => {
  test("redireciona para o Dashboard e nÃ£o acessa Estoque/AvaliaÃ§Ãµes", async ({ page }) => {
    await logar(page, "saude@marizopolis.gov.br");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /^VisÃ£o Geral/ })).toBeVisible();
    await expect(itemNav(page, "Dashboard")).toBeVisible();
    await expect(itemNav(page, "Pedidos e Ordens")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("vÃª os pedidos do seu setor e abre o modal de novo pedido", async ({ page }) => {
    await logar(page, "saude@marizopolis.gov.br");
    await page.goto("/pedidos");
    await page.getByRole("button", { name: "Novo Pedido" }).click();
    await expect(page.getByRole("dialog", { name: "Novo Pedido" })).toBeVisible();
    await selecionarContrato(page, "Contrato do pedido");
    await expect(page.getByText("Itens DisponÃ­veis")).toBeVisible();
    await expect(page.getByText("PLACA EM ACM").first()).toBeVisible();
  });

  test("cria um novo pedido de ponta a ponta", async ({ page }) => {
    await logar(page, "saude@marizopolis.gov.br");
    await page.goto("/pedidos");
    const antes = await page.getByText(/^REQ-\d+$/).count();
    await page.getByRole("button", { name: "Novo Pedido" }).click();
    await selecionarContrato(page, "Contrato do pedido");
    await expect(page.getByText("Itens DisponÃ­veis")).toBeVisible();
    await page.getByRole("dialog", { name: "Novo Pedido" }).locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: "Criar Pedido" }).click();
    await expect(page.getByRole("dialog", { name: "Novo Pedido" })).toHaveCount(0);
    await expect(page.getByText(/^REQ-\d+$/)).toHaveCount(antes + 1);
  });
});

test.describe("Secretaria de LicitaÃ§Ãµes (lic@marizopolis.gov.br)", () => {
  test("redireciona para /contratos e vÃª o contrato 00141/2026-SDC", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await expect(page).toHaveURL("/contratos");
    await expect(page.getByText("00141/2026-SDC")).toBeVisible();
    await expect(itemNav(page, "Renovacoes")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("fila de pedidos somente leitura (sem aÃ§Ãµes de status)", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText(/SolicitaÃ§Ãµes do seu setor/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Compra" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Novo Pedido" })).toHaveCount(0);
  });

  test("acompanha termos de renovaÃ§Ã£o e nÃ£o pode emitir", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await page.goto("/renovacoes");
    await expect(page.getByRole("heading", { name: "Termos de RenovaÃ§Ã£o" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Solicitar Termo" })).toHaveCount(0);
  });
});

test.describe("Compras (compras@marizopolis.gov.br)", () => {
  test("acessa a fila de compras e nÃ£o vÃª Estoque/AvaliaÃ§Ãµes", async ({ page }) => {
    await logar(page, "compras@marizopolis.gov.br");
    await expect(page).toHaveURL("/");
    await expect(itemNav(page, "Dashboard")).toBeVisible();
    await expect(itemNav(page, "Contratos")).toBeVisible();
    await expect(itemNav(page, "Pedidos e Ordens")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("opera a fila (registra compra) e nÃ£o cria pedido", async ({ page }) => {
    await logar(page, "compras@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText(/Fila de compras/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Todos \(/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo Pedido" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Conferir e Concluir" })).toHaveCount(0);
  });

  test("vÃª Contratos em leitura (sem confirmar revisÃ£o)", async ({ page }) => {
    await logar(page, "compras@marizopolis.gov.br");
    await page.goto("/contratos");
    await expect(page.getByText("00141/2026-SDC")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar RevisÃ£o" })).toHaveCount(0);
  });
});

test.describe("FiscalizaÃ§Ã£o de Contratos (fcon@marizopolis.gov.br)", () => {
  test("acessa todas as Ã¡reas operacionais", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await expect(page).toHaveURL("/");
    await expect(itemNav(page, "Estoque")).toBeVisible();
    await expect(itemNav(page, "Avaliacoes")).toBeVisible();
    await expect(itemNav(page, "Renovacoes")).toBeVisible();
  });

  test("recebe apenas os pedidos entregues, sem as etapas do Compras", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText(/Pedidos entregues pelo Compras aguardando conferÃªncia/)).toBeVisible();
    // As etapas do pedido pertencem Ã  tela do Compras.
    await expect(page.getByRole("button", { name: /^Todos \(/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Registrar Compra/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Compra Efetuada/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Informar Chegada/ })).toHaveCount(0);
    // Filtros de gestÃ£o tambÃ©m ficam no Compras; sobra apenas a busca.
    await expect(page.getByLabel("Filtrar por secretaria")).toHaveCount(0);
    await expect(page.getByLabel("Ordenar pedidos")).toHaveCount(0);
    // HistÃ³rico do que jÃ¡ foi conferido fica disponÃ­vel para reimprimir o termo.
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

  test("visualiza avaliaÃ§Ãµes e resumo do fornecedor", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/avaliacoes");
    await selecionarContrato(page, "Contrato da avaliacao");
    await expect(page.getByText("Resumo do Fornecedor")).toBeVisible();
    await expect(page.getByText(/avaliaÃ§Ãµes registradas neste contrato/)).toBeVisible();
    await expect(page.getByText("Entregas com Problema")).toBeVisible();
  });

  test("visualiza termos de renovaÃ§Ã£o sem permissÃ£o de emitir", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/renovacoes");
    await expect(page.getByRole("heading", { name: "Termos de Renovação" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Solicitar Termo" })).toHaveCount(0);
  });
});
