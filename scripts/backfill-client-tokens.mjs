// Preenche Client.internalToken / coverToken vazios (clientes criados depois da fase 1,
// quando a coluna não tinha DEFAULT no banco). Idempotente: só mexe em quem está null.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const clients = await p.client.findMany({
  where: { OR: [{ internalToken: null }, { coverToken: null }] },
  select: { id: true, name: true, internalToken: true, coverToken: true },
});
for (const c of clients) {
  const data = {};
  if (!c.internalToken) data.internalToken = randomUUID();
  if (!c.coverToken) data.coverToken = randomUUID();
  await p.client.update({ where: { id: c.id }, data });
  console.log("ok:", c.name, Object.keys(data).join(", "));
}
console.log(`${clients.length} cliente(s) corrigido(s).`);
await p.$disconnect();
