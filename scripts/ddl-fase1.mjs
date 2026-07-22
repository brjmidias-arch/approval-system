import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const stmts = [
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "token" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "internalToken" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Client_token_key" ON "Client"("token")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Client_internalToken_key" ON "Client"("internalToken")`,
  `ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "clientId" TEXT`,
  `ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT'`,
];
for (const s of stmts) { await p.$executeRawUnsafe(s); console.log("ok:", s.slice(0, 60)); }
await p.$executeRawUnsafe(
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentItem_clientId_fkey') THEN ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
);
console.log("FK ok");
await p.$disconnect();
