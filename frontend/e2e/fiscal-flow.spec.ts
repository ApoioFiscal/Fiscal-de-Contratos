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
  test("redireciona para o Dashboard e não acessa Estoque/Avaliações", async ({ page }) => {
    await logar(page, "saude@marizopolis.gov.br");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /^Visão Geral/ })).toBeVisible();
    await expect(itemNav(page, "Dashboard")).toBeVisible();
    await expect(itemNav(page, "Pedidos e Ordens")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("vê os pedidos do seu setor e abre o modal de novo pedido", async ({ page }) => {
    await logar(page, "saude@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText("REQ-001")).toBeVisible();
    await expect(page.getByText("REQ-002")).toBeVisible();
    await page.getByRole("button", { name: "Novo Pedido" }).click();
    await expect(page.getByRole("dialog", { name: "Novo Pedido" })).toBeVisible();
    await selecionarContrato(page, "Contrato do pedido");
    await expect(page.getByText("Itens Disponíveis")).toBeVisible();
    await expect(page.getByText("Dipirona 500mg")).toBeVisible();
  });

  test("cria um novo pedido de ponta a ponta", async ({ page }) => {
    await logar(page, "saude@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText("REQ-001")).toBeVisible();
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
  test("redireciona para /licitacoes e vê o contrato LIC-2026-001", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await expect(page).toHaveURL("/licitacoes");
    await expect(page.getByText("LIC-2026-001")).toBeVisible();
    await expect(itemNav(page, "Renovacoes")).toBeVisible();
    await expect(itemNav(page, "Estoque")).toHaveCount(0);
    await expect(itemNav(page, "Avaliacoes")).toHaveCount(0);
  });

  test("fila de pedidos somente leitura (sem ações de status)", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText("REQ-002")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Compra" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Novo Pedido" })).toHaveCount(0);
  });

  test("acompanha termos de renovação e não pode emitir", async ({ page }) => {
    await logar(page, "lic@marizopolis.gov.br");
    await page.goto("/renovacoes");
    await expect(page.getByText(/Termo #1/)).toBeVisible();
    await expect(page.getByText("Resolvido")).toBeVisible();
    await expect(page.getByText("Aditivo de Vigência")).toBeVisible();
    await expect(page.getByRole("button", { name: "Emitir Termo" })).toHaveCount(0);
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

  test("opera a fila de pedidos (ação Registrar Compra visível)", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/pedidos");
    await expect(page.getByText("REQ-002")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Compra" }).first()).toBeVisible();
  });

  test("visualiza saldos de estoque do contrato", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/estoque");
    await selecionarContrato(page, "Contrato do estoque");
    await expect(page.getByText("Dipirona 500mg").first()).toBeVisible();
    await expect(page.getByText("Paracetamol 750mg").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrada de Nota" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dar Baixa" })).toBeVisible();
  });

  test("visualiza avaliações e resumo do fornecedor", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/avaliacoes");
    await selecionarContrato(page, "Contrato da avaliacao");
    await expect(page.getByText("Resumo do Fornecedor")).toBeVisible();
    await expect(page.getByText("3.5")).toBeVisible();
    await expect(page.getByText("2 avaliações registradas neste contrato.")).toBeVisible();
    await expect(page.getByText("Entregas com Problema")).toBeVisible();
  });

  test("emite termo de renovação e vê o histórico resolvido", async ({ page }) => {
    await logar(page, "fcon@marizopolis.gov.br");
    await page.goto("/renovacoes");
    await expect(page.getByText(/Termo #1/)).toBeVisible();
    await expect(page.getByText("Aditivo de Vigência")).toBeVisible();
    await expect(page.getByRole("button", { name: "Emitir Termo" })).toBeVisible();
  });
});