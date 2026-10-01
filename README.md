# Fiscal de Contratos — Sistema Integrado de Gestão

Sistema de gestão de **licitações, contratos e pedidos** de uma prefeitura municipal. Controla o ciclo do contrato — da importação da licitação até a geração do arquivo de contrato — e o ciclo dos pedidos das secretarias (de compra até a entrega/conclusão), além de estoque, avaliações, renovações e gestão de secretarias/usuários.

## Estrutura do repositório (monorepo)

O projeto é dividido em **três pacotes independentes**, cada um com seu `package.json`:

| Pasta      | Descrição                                                        | Porta |
| ---------- | ---------------------------------------------------------------- | ----- |
| `backend/` | API `apoiofiscal` — Express 5 + Prisma 7 (auth, setores, usuários, licitações, pedidos, estoque, avaliações, renovações, geração de contrato). Serve sob `/api`. | **3333** |
| `frontend/`| Interface React 18 + Vite + MUI/Radix + Tailwind (ESM).           | **5173** |
| `parsing/` | API de extração de dados de PDFs (Express 5 + pg, regras ou Ollama). Rotas em `/upload`, `/health` e `/` (não usam `/api`). | **3000** |

Não há workspace no npm: cada comando é executado dentro da pasta de cada pacote (use `npm --prefix <pasta> ...` a partir da raiz).

## Requisitos

- **Node.js** 18+
- **PostgreSQL** 12+ rodando em `localhost:5432` (default)

## Configurando o banco de dados

> Importante: `backend` e `parsing` compartilham o **mesmo banco** `prefeitura`.

1. Crie o banco no PostgreSQL:
   ```sql
   CREATE DATABASE prefeitura;
   ```
2. Configure as variáveis de ambiente (veja seção abaixo) com a `DATABASE_URL` apontando para esse banco.
3. Sincronize o schema do backend (o repositório **não** usa migrations; as mudanças são aplicadas com `db push`):
   ```bash
   cd backend
   npx prisma db push
   ```
4. Crie a tabela auxiliar do parsing (deve rodar **antes** do servidor de parsing):
   ```bash
   cd parsing
   npm run db:init
   ```

## Variáveis de ambiente

Cada pacote lê o **próprio** `.env` (fora do versionamento). Copie o `.env.example` correspondente:

- `backend/.env.example` → `backend/.env`
  - `DATABASE_URL` (PostgreSQL), `JWT_SECRET` (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `PORT` (3333), `NODE_ENV`.
- `parsing/.env.example` → `parsing/.env`
  - `DATABASE_URL`, `PORT` (3000), `PARSER_MODE` (`rules` por padrão; `ollama` é opcional e tem fallback automático).
- `frontend` não usa variáveis de ambiente: o proxy da API vai para `http://localhost:3333` (definido em `frontend/vite.config.ts`).

## Instalação e execução

A partir da **raiz** do repositório:

```bash
# 1. Instala as dependências dos três pacotes
npm run install:all

# 2. Sobe backend, frontend e parsing juntos (o parsing roda o db:init antes)
npm run dev
```

Também é possível rodar cada serviço isoladamente, dentro da própria pasta (`npm run dev`).

- Frontend: abra `http://localhost:5173/login`
- Backend: `http://localhost:3333`
- Parsing: `http://localhost:3000`

## Credenciais de desenvolvimento

O seed cria um usuário administrador de exemplo (somente para desenvolvimento):

- **E-mail:** `admin@marizopolis.gov.br`
- **Senha:** `123456`

Além dele, o seed garante os setores `GAB`, `LIC` e `FCON`, e duas licitações de exemplo (`LIC-<ano>-001`, contrato ativo, e `LIC-<ano>-002`, aguardando geração de contrato). Para aplicar/atualizar o seed:

```bash
npm --prefix backend run seed
```

## Comandos úteis

| Ação                          | Comando                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| Instalar tudo (raiz)          | `npm run install:all`                                       |
| Rodar tudo (raiz)             | `npm run dev`                                               |
| Build de todos                | `npm run build` (na raiz)                                   |
| Build do backend              | `cd backend && npm run build` (tsc)                        |
| Build do frontend             | `cd frontend && npm run build` (vite build)                |
| Build do parsing              | `cd parsing && npm run build`                               |
| Testes do parsing             | `cd parsing && npm test`                                    |
| Testes E2E (Playwright)       | `cd frontend && npm run test:e2e` (sobe backend:3333 + vite:5173) |
| Sync do schema (backend)      | `cd backend && npx prisma db push`                          |
| Seed (backend)                | `cd backend && npx ts-node-dev --transpile-only prisma/seed.ts` |
| Init da tabela do parsing     | `cd parsing && npm run db:init`                             |

> No Windows PowerShell, a política de restrição pode bloquear o `npm.ps1`; neste caso use `cmd /c npm ...`.

## Perfis e fluxos principais

- **Secretarias (`secretaria`)**: veem o Dashboard, fazem **Pedidos e Ordens** (apenas os próprios pedidos) e não acessam licitações.
- **Secretaria de Licitações (`licitacoes`)**: importa licitações (uploads de PDF) e **gera o arquivo de contrato**; gere licitações/renovações.
- **Fiscalização de Contratos (`contratos`/`fiscal`)**: opera a **fila de pedidos** de todas as secretarias (transições de status e previsão de entrega), controla estoque, avaliações, renovações e baixa o arquivo de contrato.
- **Gabinete (`gabinete`)**: Dashboard, seus próprios pedidos e a **Gestão de Secretarias**.

O fluxo do contrato: **importação → status `RASCUNHO` → "Gerar Contrato" (LIC) → arquivo DOCX gerado (modelo placeholder) → status `ATIVA` → FCON baixa "Ver Contrato"**.

## Documentação técnica

O arquivo [`AGENTS.md`](AGENTS.md) contém a documentação técnica do sistema (arquitetura, convenções de código, rotas, armadilhas de integração e comandos). Mantenha-o atualizado ao alterar comportamento de módulos.
