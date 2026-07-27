import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const check = process.argv.includes("--check");

try {
  if (check) {
    const cols = await prisma.$queryRawUnsafe(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name IN ('Client','ContentItem')
       AND column_name IN ('roteiroClienteId','roteiroConteudoId')`
    );
    console.log("existing target columns:", cols);
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Client','ContentItem')`
    );
    console.log("tables:", tables);
  } else {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "roteiroClienteId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "roteiroConteudoId" TEXT;`);
    console.log("DDL aplicado (colunas adicionadas se ainda não existiam).");
  }
} catch (e) {
  console.error("ERRO:", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
