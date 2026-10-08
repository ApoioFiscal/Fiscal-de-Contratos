#!/bin/sh
# Aplica o schema do Prisma. Se o `db push` falhar (ex.: enum StatusPedido
# trocou e ainda existem pedidos com valores antigos no banco), limpa os
# registros de pedidos antigos e tenta novamente. Idempotente e seguro:
# em bancos novos ou já migrados, o push passa de primeira e nada é apagado.
set -e

echo "==> prisma generate"
npx prisma generate

if npx prisma db push; then
  echo "==> schema do banco ok"
  exit 0
fi

echo "==> db push falhou (provavel enum antigo); limpando pedidos antigos e tentando de novo"
npx prisma db execute --file prisma/cleanup_pedidos.sql
npx prisma db push