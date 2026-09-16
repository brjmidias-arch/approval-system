import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
await p.$executeRawUnsafe(`ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "stageKey" TEXT`);
await p.$executeRawUnsafe(`ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "stageSince" TIMESTAMP(3)`);
console.log("ok: stageKey, stageSince");
await p.$disconnect();
