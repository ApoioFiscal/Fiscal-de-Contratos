-- Remove o valor CONFERENCIA do enum StatusPedido de forma idempotente.
-- Executado pelo schema-clean.sh quando o `db push` falha ao tentar dropar o
-- valor do enum no Postgres (Prisma nao suporta DROP VALUE). Preserva os
-- dados: pedidos legados em CONFERENCIA migram para ENTREGUE, que agora
-- engloba a fase de conferencia. No-op quando o valor ja nao existe.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'StatusPedido' AND e.enumlabel = 'CONFERENCIA'
  ) THEN
    UPDATE "pedido"
       SET "status" = 'ENTREGUE'::"StatusPedido"
     WHERE "status" = 'CONFERENCIA'::"StatusPedido";

    UPDATE "pedido_historico"
       SET "status" = 'ENTREGUE'::"StatusPedido"
     WHERE "status" = 'CONFERENCIA'::"StatusPedido";

    ALTER TABLE "pedido" ALTER COLUMN "status" DROP DEFAULT;

    ALTER TYPE "StatusPedido" RENAME TO "StatusPedido_old";
    CREATE TYPE "StatusPedido" AS ENUM (
      'PENDENTE','CONFIRMADO','EFETUADO','ENTREGUE','CONCLUIDO','DEVOLVIDO','CANCELADO'
    );

    ALTER TABLE "pedido" ALTER COLUMN "status" TYPE "StatusPedido"
      USING "status"::text::"StatusPedido";
    ALTER TABLE "pedido_historico" ALTER COLUMN "status" TYPE "StatusPedido"
      USING "status"::text::"StatusPedido";

    DROP TYPE "StatusPedido_old";
  END IF;
END $do$;