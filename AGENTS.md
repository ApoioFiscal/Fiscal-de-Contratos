# AGENTS.md — Documentação Técnica do Sistema

Documentação técnica de referência para o desenvolvimento do **Sistema Integrado de Gestão de Licitações, Contratos e Pedidos** ("Fiscal de Contratos").

## Repositório e estrutura

O repositório é um monorepo com **três pacotes independentes** (sem workspace npm). Cada pacote tem seu `package.json` e seu próprio `.env`:

- `backend/` — API `apoiofiscal`: Express 5 + Prisma 7 (auth, setores, usuários, licitações/contratos, pedidos, estoque, avaliações, renovações e geração de arquivo de contrato). TypeScript CommonJS.
- `frontend/` — React 18 + Vite + MUI/Radix + Tailwind. ESM.
- `parsing/` — API de extração de dados de PDFs (Express 5 + pg), por regras ou Ollama. CommonJS.

Todos os comandos são executados a partir da raiz com `npm --prefix <pasta> ...` ou dentro da pasta de cada pacote.

### Comandos globais (raiz)

- `npm run install:all` — instala dependências dos três pacotes.
- `npm run dev` — sobe backend (3333), frontend (5173) e parsing (3000) juntos (via `concurrently`). Roda `parsing db:init` automaticamente antes.
- `npm run build` — build de backend, frontend e parsing.
- `npm run test:parsing` — testes do parsing.

## Portas (não confie nos READMEs antigos)

- `backend`: `PORT` env, default **3333**. Serve sob `/api` (rotas: `/api/setores`, `/api/usuarios`, `/api/licitacoes` (CRUD de licitação/contrato — criação e geração de contrato exigem perfil `licitacoes` ou `gabinete`), `/api/pedidos` (criação pela secretaria beneficiária (qualquer autenticado) ou licitações/gabinete; fila `/fila` requer **somente** `contratos`/`fiscal`; `/meus` retorna pedidos do setor do usuário; transição de status `/status` requer **somente** `contratos`/`fiscal`), `/api/estoque` (entrada de nota `/`, baixa `/baixas`, movimentações `/?itemLicitadoId=&contratoId=`, saldos `/contrato/:id` — entrada/baixa exigem `contratos`/`fiscal`), `/api/avaliacoes` (criar + `/resumo/:id` com médias/problemas), `/api/renovacoes` (FCON emite, LIC resolve via PATCH `/:id` — resolver exige `licitacoes`/`gabinete` e `acaoTomada` obrigatória no RESOLVIDO)). Rotas extras de licitação: `POST /:id/gerar-contrato` (LIC/gabinete) e `GET /:id/arquivo` (download autenticado).
- `frontend` (Vite): proxy de `/api` → `http://localhost:3333` (o `vite.config.ts` é a fonte autoritativa; README antigo citava 3000). Dev server abre `http://localhost:5173/login`. Sem variáveis de ambiente.
- `parsing`: `PORT` env, default **3000**. **Não** fica sob `/api` — rotas `/upload`, `/health` e `/`.

### Iniciar serviços

- backend: `npm run dev` (ts-node-dev). Precisa de `.env` com `DATABASE_URL` e `JWT_SECRET`, além de banco sincronizado via `npx prisma db push` (o repo **não** tem pasta `migrations/`; mudanças de schema se aplicam com `db push`, não `prisma migrate`).
- frontend: `npm i; npm run dev`.
- parsing: copiar `parsing/.env.example` → `.env`, depois **`npm run db:init` ANTES de `npm run dev`** (cria/atualiza só a tabela `pdf_data`; o banco em si precisa já existir). O `PARSER_MODE` default é `rules`; se `PARSER_MODE=ollama` falhar, há fallback automático (`parser_used: "rules_fallback"`).

## Variáveis de ambiente

Os `.env` são gitignored. Exemplos versionados: `backend/.env.example` e `parsing/.env.example`.

- Backend: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`.
- Parsing: `DATABASE_URL`, `PORT`, `PARSER_MODE` (`rules`|`ollama`, default `rules`), `OLLAMA_URL`/`OLLAMA_MODEL`/`OLLAMA_TIMEOUT_MS`/`OLLAMA_KEEP_ALIVE` (opcionais).
- Frontend: nenhuma (proxy fixo).

> Datasource: backend e parsing compartilham o banco `prefeitura`.

## Armadilha de integração frontend ↔ parsing

`frontend/src/app/pages/Biddings.tsx` usa `fetch("http://localhost:3000/upload")` hardcoded para upload de PDF e lê `structured_data.processo`, `campos_rotulados`, etc. direto da resposta do parsing (schema version `2.1-mvp`). Se mudar o formato da resposta, essa página quebra silenciosamente. Até aqui, as mudanças foram aditivas: para `tipo_documento === "nota_fiscal"` é anexado um bloco `structured_data.nota_fiscal` (`numero`, `data_de_emissao`, `fornecedor`, `cnpj_emitente`, `valor_total`) em `parsing/src/services/notaFiscalService.ts`.

## Convenções do backend

- Arquitetura: rota → controller → service → repository, com injeção de dependências no nível da rota.
- Schemas Zod em `backend/src/common/schemas.ts`; middlewares (`validateBody`, `validateParams`, `autenticationMiddleware`, `errorHandler`) em `backend/src/common/middleware.ts`.
- Atenção: `validateBody` em `backend/src/common/middleware.ts` ainda tem aparência de problema não resolvido (o `catch` lança dentro de callback não-assíncrono do `schema.parse`). O client Prisma em `prisma/client.ts` usa o driver adapter `@prisma/adapter-pg`.
- `requerPerfil(...)` vive em `backend/src/common/perfil.ts`.

## Modelo de dados (schema.prisma)

Models: `Setor`, `Usuario`, `LicitacaoContrato`, `ItemLicitado`, `LicitacaoSetor`, `Pedido`, `PedidoItem`, `NotaFiscal`, `NotaFiscalItem`, `MovimentacaoEstoque`, `Avaliacao`, `TermoRenovacao` (a antiga `Solicitacao` foi removida). Rotas de **setor/usuario/licitacao/pedido/estoque/avaliacao/renovacao** ligadas em `backend/src/routes/index.ts`.

`LicitacaoContrato` tem `status` default `RASCUNHO` (a licitação importada aguarda "Gerar Contrato"), campos `arquivoContrato` e `dataGeracaoContrato` preenchidos pela geração. `Pedido` carrega `dataPrevistaEntrega`, definida pelo FCON ao registrar a compra (EM_COMPRA) — não mais informada na criação pela secretaria.

## Perfis e regras de acesso

- `secretaria`: Dashboard + Pedidos e Ordens (só os próprios, `/meus`). **Não** vê "Licitações & Contratos".
- `licitacoes`: Dashboard, Licitações & Contratos (com `Nova Licitação` e `Gerar Contrato`), Pedidos e Ordens (apenas os próprios), Renovações.
- `contratos`/`fiscal`: FCON — Dashboard, Licitações & Contratos (só leitura e download do contrato), Pedidos e Ordens (**fila** de todas as secretarias + transições de status), Estoque, Avaliações, Renovações.
- `gabinete`: Dashboard, Pedidos e Ordens (como secretaria) e Gestão de Secretarias. Sem fila, sem licitações/estoque/avaliações/renovações.

## Geração do arquivo de contrato

- Fluxo: importação cria licitação em `RASCUNHO` → LIC clica em **Gerar Contrato** (`POST /api/licitacoes/:id/gerar-contrato`) → gera DOCX (placeholder via `backend/src/modules/licitacao/geradorContrato.ts`, interface `GeradorContrato` — trocar o motor por docxtemplater/PDF quando chegar o modelo oficial da prefeitura) em `backend/uploads/contratos/` → status vira `ATIVA` + `arquivoContrato`/`dataGeracaoContrato` → todos podem baixar via `GET /api/licitacoes/:id/arquivo`.
- Frontend (Biddings.tsx): botão `Gerar Contrato` só para LIC/gabinete e apenas em licitações sem arquivo; `Ver Contrato` (download) aparece quando `arquivoContrato` existe (qualquer perfil habilitado a ver a página).

## Seed (desenvolvimento)

`npx ts-node-dev --transpile-only prisma/seed.ts` cria setores `GAB`, `LIC`, `FCON`, admin `admin@marizopolis.gov.br` / `123456`, e as licitações de exemplo `LIC-<ano>-001` (ATIVA, com itens) e `LIC-<ano>-002` (RASCUNHO, aguardando geração de contrato).

## Testes E2E

`frontend/playwright.config.ts` sobe backend:3333 + vite:5173 via `webServer` e roda `e2e/fiscal-flow.spec.ts` (11 testes por perfil `saude@`/`lic@`/`fcon@`, senha `123456`). **O teste "cria um novo pedido" não é idempotente**: cria um `REQ-n` novo a cada execução (limite de saldo comprometido de 9750 unidades da Dipirona ⇒ ~49 execuções antes de estourar).

## Verificação obrigatória antes de finalizar

Não há lint/typecheck compartilhado. Após mudanças, rodar no mínimo:

- parsing: `npm run build` e `npm test`.
- backend: `npm run build` (tsc strict).
- frontend: `npm run build` (vite build).

No Windows PowerShell, a política de script pode bloquear o `npm.ps1` — prefixar com `cmd /c npm ...`.