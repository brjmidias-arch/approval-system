// Backfill clientReviewAt para posts que JÁ estão aguardando aprovação do cliente.
// Aproxima "entrou na etapa" pela data de criação da aprovação (fallback: criação do post).
// Dry-run por padrão; --apply grava.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const rows = await p.contentItem.findMany({
  where: { status: "CLIENT_REVIEW", clientReviewAt: null },
  select: { id: true, createdAt: true, title: true, client: { select: { name: true } }, approvalItem: { select: { createdAt: true } } },
});
console.log(`CLIENT_REVIEW sem clientReviewAt: ${rows.length}${APPLY ? "  (GRAVANDO)" : "  (dry-run)"}\n`);

let n = 0;
for (const r of rows) {
  const when = r.approvalItem?.createdAt ?? r.createdAt;
  n++;
  if (n <= 20) console.log(`• ${r.client?.name} — ${(r.title || "").slice(0, 34)} -> ${when.toISOString().slice(0, 10)}`);
  if (APPLY) await p.contentItem.update({ where: { id: r.id }, data: { clientReviewAt: when } });
}
console.log(`\n${APPLY ? "GRAVADO" : "Seriam atualizados"}: ${n}`);
await p.$disconnect();
