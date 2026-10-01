# Parsing de Dados de PDFs

API em Node.js e TypeScript que recebe documentos PDF, preserva o texto e as tabelas originais, organiza itens orçamentários e salva o resultado no PostgreSQL.

O processamento pode usar regras locais (`rules`) ou IA local com Ollama (`ollama`). Se o Ollama falhar, a API usa as regras automaticamente.

## Pré-requisitos

- Node.js 22.3 ou superior.
- npm.
- PostgreSQL em execução.
- Ollama, somente se você utilizar `PARSER_MODE=ollama`.

## Início rápido

Instale as dependências e crie o arquivo local de configuração:

```powershell
cmd /c npm install
Copy-Item .env.example .env
```

Abra o `.env` e ajuste principalmente a conexão com o PostgreSQL:

```env
DATABASE_URL=postgresql://postgres:senha@localhost:5432/prefeitura
```

O banco informado em `DATABASE_URL` precisa existir previamente. O comando `db:init` cria ou atualiza apenas a tabela `pdf_data`, não o banco PostgreSQL.

Depois de criar o banco e configurar o `.env`, inicialize a tabela e execute a API:

```powershell
cmd /c npm run db:init
cmd /c npm run dev
```

Depois, envie um PDF:

```powershell
curl.exe -X POST http://localhost:3000/upload -F "file=@C:\caminho\documento.pdf"
```

O campo `structured_data` da resposta contém as tabelas originais, itens orçamentários, composições de custo, cronogramas, totais e a página de origem de cada informação. Os valores textuais são preservados como aparecem no PDF; campos numéricos auxiliares são adicionados sem substituir os originais.

Comandos de verificação:

```powershell
cmd /c npm test
cmd /c npm run build
```

Consulte o [Guia do Projeto](./GUIA_DO_PROJETO.md) para entender a arquitetura, cada arquivo, configurações, banco, endpoints, Ollama e solução de problemas.
