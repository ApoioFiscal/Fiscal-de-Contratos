import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// O driver adapter não lê `?schema=` da URL de forma confiável: o schema do contrato
// com o banco precisa ser explícito. Em produção fica vazio (schema `public`);
// para desenvolvimento isolado usamos `DB_SCHEMA=contrato_dev`.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
  ...(process.env.DB_SCHEMA ? { schema: process.env.DB_SCHEMA } : {}),
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
