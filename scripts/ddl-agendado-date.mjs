import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
await p.$executeRawUnsafe(`ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "agendadoDate" TIMESTAMP(3)`);
console.log("ok: agendadoDate");
await p.$disconnect();
