# Guia do Projeto — Parsing de Dados de PDFs

## 1. O que é este projeto

Este projeto é uma API REST que transforma o conteúdo textual de arquivos PDF em dados pesquisáveis. Ela foi pensada para documentos administrativos, como licitações, pregões, contratos, notas fiscais, recibos e relatórios.

Ao receber um PDF, a aplicação:

1. valida e armazena o arquivo temporariamente;
2. extrai seu texto e suas tabelas com `pdf-parse`;
3. preserva as células originais e organiza itens, composições e cronogramas;
4. complementa a extração por regras locais ou pelo Ollama;
5. salva metadados, texto bruto, tabelas e JSON no PostgreSQL;
6. remove o arquivo temporário, mesmo quando ocorre erro.

O PDF original não é guardado no banco. PDFs compostos apenas por imagens não são lidos, pois o projeto ainda não possui OCR.

## 2. Tecnologias utilizadas

| Tecnologia | Função |
| --- | --- |
| Node.js | Ambiente de execução da API |
| TypeScript | Tipagem e compilação do código |
| Express | Servidor HTTP e rotas |
| Multer | Recebimento do PDF por `multipart/form-data` |
| pdf-parse | Extração do texto e das tabelas do PDF |
| PostgreSQL | Persistência dos dados |
| pg | Conexão do Node.js com o PostgreSQL |
| Ollama | IA local opcional para interpretar os documentos |

O projeto usa `pdf-parse` 2.4, `fetch` e `AbortSignal.timeout`, portanto recomenda-se Node.js 22.3 ou superior.

## 3. Estrutura de pastas e arquivos

```text
.
├── src/
│   ├── index.ts                         inicia o Express e registra as rotas
│   ├── controllers/
│   │   └── uploadController.ts          controla resposta, erros e limpeza do PDF
│   ├── routes/
│   │   └── upload.ts                    configura Multer e POST /upload
│   ├── services/
│   │   ├── pdfService.ts                valida e extrai texto e tabelas do PDF
│   │   ├── parserService.ts             escolhe rules ou ollama
│   │   ├── rulesParserService.ts        extrai padrões com expressões regulares
│   │   ├── tableParserService.ts        classifica tabelas e organiza seus dados
│   │   ├── ollamaService.ts             chama a API local do Ollama
│   │   ├── dbService.ts                 grava o resultado no PostgreSQL
│   │   └── rulesParserService.test.ts   testes do parser por regras
│   ├── scripts/
│   │   └── initDb.ts                    executa o SQL de inicialização
│   └── utils/
│       ├── fileName.ts                  corrige nomes UTF-8 recebidos no upload
│       └── init_db.sql                  cria ou atualiza a tabela pdf_data
├── uploads/                              armazenamento temporário dos uploads
├── dist/                                 JavaScript gerado pelo build
├── .env                                  configuração local e secreta
├── .env.example                          modelo seguro de configuração
├── .gitignore                            impede versionamento de segredos e artefatos
├── package.json                          dependências e comandos
├── tsconfig.json                         configuração do TypeScript
└── README.md                              apresentação e início rápido
```

### O que cada camada faz

- `routes`: define URLs, método HTTP, tamanho máximo e formato do arquivo.
- `controllers`: recebe a requisição, chama os serviços e escolhe a resposta HTTP.
- `services`: contém o processamento do PDF, os parsers e o acesso ao banco.
- `scripts` e `utils`: inicializam e mantêm a estrutura do banco.

## 4. Fluxo de uma requisição

```text
Cliente
  -> POST /upload
  -> Multer valida MIME e limite de 15 MB
  -> pdfService confirma a assinatura %PDF-
  -> pdf-parse extrai o texto e as tabelas por página
  -> tableParserService preserva células e organiza itens, composições e cronogramas
  -> parserService escolhe a estratégia
       -> rulesParserService
       ou
       -> ollamaService (com fallback para rules)
  -> dbService salva em pdf_data
  -> controller remove o arquivo temporário
  -> resposta 201 para o cliente
```

O arquivo temporário também é removido quando a extração, o parser ou o banco falha. Arquivos que já estavam em `uploads/` antes desta implementação não são removidos automaticamente.

## 5. Instalação e configuração

### Pré-requisitos

- Node.js 22.3 ou superior;
- npm;
- PostgreSQL em execução;
- Ollama somente se o modo de IA for utilizado.

### Instalar dependências

```powershell
cmd /c npm install
```

### Criar o arquivo de ambiente

No PowerShell:

```powershell
Copy-Item .env.example .env
```

Edite o `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:senha@localhost:5432/prefeitura
PARSER_MODE=rules
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma
OLLAMA_TIMEOUT_MS=30000
```

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `PORT` | não | Porta HTTP; padrão `3000` |
| `DATABASE_URL` | sim | URL completa de conexão com o PostgreSQL |
| `PARSER_MODE` | não | `rules` ou `ollama`; padrão `rules` |
| `OLLAMA_URL` | no modo IA | Endereço da API do Ollama |
| `OLLAMA_MODEL` | no modo IA | Modelo instalado no Ollama |
| `OLLAMA_TIMEOUT_MS` | não | Tempo máximo da chamada de IA; padrão `30000` ms |

O `.env` pode conter senha e está bloqueado no `.gitignore`. O `.env.example` deve permanecer sem credenciais reais.

## 6. Banco de dados

Crie previamente o banco indicado em `DATABASE_URL` e inicialize a tabela:

```powershell
cmd /c npm run db:init
```

O script é idempotente: pode ser executado novamente para criar campos ausentes e adaptar versões antigas da tabela.

### Tabela `pdf_data`

| Coluna | Conteúdo |
| --- | --- |
| `id` | identificador sequencial |
| `original_name` | nome original do PDF |
| `mime_type` | tipo MIME informado no upload |
| `file_size` | tamanho em bytes |
| `raw_text` | texto integral extraído |
| `structured_data` | dados estruturados em JSONB |
| `extraction_summary` | resumo da extração |
| `created_at` | data e hora de criação |

O `structured_data` usa o formato `schema_version: "2.0"` e inclui:

- `tabelas_originais`: todas as células encontradas, separadas por página e tabela;
- `itens_orcamentarios`: item, código, descrição, fonte, unidade, quantidade e valores;
- `composicoes_custo`: equipamentos, materiais e mão de obra, sem confundi-los com itens principais;
- `cronogramas`: percentuais e valores por período;
- `totais_orcamentarios`: BDI, orçamento sem BDI e valor total;
- `avisos_extracao`: inconsistências ou estruturas que precisam de revisão.

Cada item mantém `linha_original`, `pagina_origem`, `tabela_origem` e `linha_origem`. Os textos monetários permanecem exatamente como foram extraídos. Campos terminados em `_numerico` são cópias auxiliares para consultas e validações, não substituições do conteúdo original.

Exemplo de consulta aos itens:

```sql
SELECT
  id,
  original_name,
  structured_data->'itens_orcamentarios' AS itens
FROM pdf_data
ORDER BY id DESC;
```

Consulta básica:

```sql
SELECT id, original_name, extraction_summary, created_at
FROM pdf_data
ORDER BY id DESC;
```

Para saber qual parser foi utilizado:

```sql
SELECT
  id,
  structured_data->>'parser_used' AS parser_used,
  structured_data->>'fallback_reason' AS fallback_reason
FROM pdf_data
ORDER BY id DESC;
```

## 7. Modos de extração

### Regras locais

Use no `.env`:

```env
PARSER_MODE=rules
```

Esse modo não depende de IA. A extração de tabelas continua ativa e organiza estruturas reconhecidas de forma determinística. As regras também identificam tipo do documento, CPF, CNPJ, telefone, CEP contextual, datas, valores monetários, e-mails, URLs, campos rotulados e até 40 linhas relevantes.

### Ollama

Instale um modelo e inicie o serviço:

```powershell
ollama pull gemma
ollama serve
```

Configure:

```env
PARSER_MODE=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma
```

O Ollama recebe o texto e deve retornar JSON. Se estiver indisponível, exceder o tempo configurado ou devolver conteúdo inválido, o sistema continua com regras locais. Nesse caso, `structured_data` contém:

```json
{
  "parser_used": "rules_fallback",
  "fallback_reason": "motivo da falha"
}
```

## 8. Executar a aplicação

Durante o desenvolvimento:

```powershell
cmd /c npm run dev
```

Para simular produção:

```powershell
cmd /c npm run build
cmd /c npm start
```

Rotas disponíveis:

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` | `/` | informações básicas da API e parser configurado |
| `GET` | `/health` | confirma que o processo HTTP está ativo |
| `POST` | `/upload` | recebe um PDF no campo `file` |

O `/health` é uma verificação de processo; ele não testa a conexão com PostgreSQL ou Ollama.

### Enviar um PDF

```powershell
curl.exe -X POST http://localhost:3000/upload -F "file=@C:\caminho\documento.pdf"
```

No Postman, escolha `Body`, `form-data`, crie a chave `file`, altere seu tipo para `File` e selecione o PDF.

Respostas principais:

- `201`: documento processado e salvo;
- `400`: campo ausente, tipo rejeitado, arquivo grande ou upload inválido;
- `422`: conteúdo não é um PDF válido ou não possui texto extraível;
- `500`: falha inesperada, normalmente no banco ou no processamento.

A resposta de sucesso não devolve `raw_text`, evitando transferir novamente um texto potencialmente grande e sensível. Ele continua disponível no banco.

## 9. Comandos do projeto

| Comando | Função |
| --- | --- |
| `npm run dev` | executa o TypeScript diretamente |
| `npm run db:init` | cria ou atualiza a tabela no PostgreSQL |
| `npm test` | executa os testes do parser por regras |
| `npm run build` | compila `src/` para `dist/` |
| `npm start` | executa a versão compilada |

No PowerShell com política de scripts restrita, use `cmd /c` antes dos comandos npm.

## 10. Segurança e cuidados com dados

- PDFs podem conter CPF, CNPJ e outros dados pessoais; proteja o banco e limite seu acesso.
- Não publique o `.env` nem inclua credenciais no `.env.example`.
- O MIME e a assinatura inicial do PDF são validados, mas isso não substitui antivírus em um ambiente público.
- A rota ainda não possui autenticação nem limitação por endereço IP. Não exponha a API diretamente à internet antes de implementar esses controles.
- O limite atual é 15 MB por arquivo.
- O texto enviado ao Ollama permanece na infraestrutura onde a URL configurada aponta. Confirme a política de dados caso deixe de usar uma instância local.

## 11. Problemas comuns

### `DATABASE_URL nao configurada` ou erro de conexão

Confira o `.env`, confirme que o PostgreSQL está ligado, que o banco existe e execute `npm run db:init`.

### O PDF retorna status 422

O arquivo pode estar corrompido, não ser realmente um PDF ou conter apenas imagens. Para documentos escaneados, será necessário incorporar OCR.

### O sistema usa `rules_fallback`

Confira `ollama list`, teste `http://localhost:11434/api/tags`, valide o nome em `OLLAMA_MODEL` e aumente `OLLAMA_TIMEOUT_MS` se o computador precisar de mais tempo.

### O PowerShell bloqueia `npm.ps1`

Execute o comando por meio do `cmd`, por exemplo:

```powershell
cmd /c npm test
```
