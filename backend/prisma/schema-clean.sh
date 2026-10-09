#!/bin/sh
# Aplica o schema do Prisma com recuperacao em cadeia (idempotente):
#   1. db push normal (--accept-data-loss, obrigatorio pois o enum StatusPedido
#      REMOVE os valores antigos EM_COMPRA/RECUSADO);
#   2. se falhar, limpa apenas os pedidos antigos e tenta de novo;
#   3. se ainda falhar (estado inconsistente, ex.: P1014), reseta o schema
#      public (DROP SCHEMA public CASCADE) e tenta de novo — o seed roda
#      depois e recria os dados-base.
# Em bancos novos ou ja migrados, o passo 1 passa direto e nada e apagado.
set -e

echo "==> prisma generate"
npx prisma generate

if npx prisma db push --accept-data-loss; then
  echo "==> schema do banco ok"
  exit 0
fi

echo "==> db push falhou; limpando pedidos antigos e tentando de novo"
npx prisma db execute --file prisma/cleanup_pedidos.sql
if npx prisma db push --accept-data-loss; then
  echo "==> schema do banco ok (apos limpeza)"
  exit 0
fi

echo "==> db push ainda falhou (estado inconsistente); resetando o schema public"
npx prisma db execute --file prisma/reset_schema.sql
npx prisma db push --accept-data-loss
echo "==> schema do banco recriado"