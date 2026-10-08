-- Remove pedidos e dados dependentes que ainda usam o enum antigo de
-- StatusPedido (EM_COMPRA/RECUSADO), permitindo o `prisma db push` aplicar
-- o novo enum sem erro. Executado apenas quando o db push falha
-- (ver schema-clean.sh). TRUNCATE CASCADE cobre pedido_item, pedido_historico,
-- nota_fiscal, nota_fiscal_item, movimentacao_estoque e avaliacao.
TRUNCATE TABLE "pedido" RESTART IDENTITY CASCADE;