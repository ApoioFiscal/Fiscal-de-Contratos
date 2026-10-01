# Fiscal de Contratos - Frontend

Este é o frontend do Sistema Integrado de Gestão de Licitações e Pedidos, desenvolvido com React, TypeScript, Vite e Tailwind CSS.

## Como rodar o projeto localmente

1. Clone o repositório e instale as dependências:
```bash
npm install
```

2. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## Integração com a API (Backend)
Para contornar problemas de CORS durante o desenvolvimento, este frontend utiliza o proxy do Vite configurado no \`vite.config.ts\`. 
Certifique-se de que o repositório do backend esteja rodando localmente na porta \`3000\`. As requisições devem ser feitas para \`/api/...\` e o Vite se encarregará de repassar para o backend.