import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
await p.$executeRawUnsafe(`ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "coverRedoNote" TEXT`);
console.log("ok: coverRedoNote");
await p.$disconnect();
