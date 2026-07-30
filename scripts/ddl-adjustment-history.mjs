import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const stmts = [
  `CREATE TABLE IF NOT EXISTS "AdjustmentHistory" (
     "id" TEXT PRIMARY KEY,
     "contentItemId" TEXT NOT NULL,
     "source" TEXT NOT NULL,
     "status" TEXT NOT NULL,
     "comment" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "AdjustmentHistory_contentItemId_idx" ON "AdjustmentHistory"("contentItemId")`,
];
for (const s of stmts) { await p.$executeRawUnsafe(s); console.log("ok:", s.slice(0, 60).replace(/\s+/g, " ")); }
await p.$executeRawUnsafe(
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdjustmentHistory_contentItemId_fkey') THEN ALTER TABLE "AdjustmentHistory" ADD CONSTRAINT "AdjustmentHistory_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
);
console.log("FK ok");
await p.$disconnect();
