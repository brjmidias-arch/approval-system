// Backfill stageKey + stageSince para posts existentes (baseline aproximado).
// Dry-run por padrão; --apply grava.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function computeStageKey(i) {
  const a = i.approvalItem?.status;
  const r = i.internalReviewItem?.status;
  if (a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED") return "adjustment";
  const isVideo = i.contentType === "REELS" || i.fileType === "VIDEO";
  switch (i.status) {
    case "INTERNAL_REVIEW":
    case "INTERNAL_DONE": return "internal";
    case "CLIENT_REVIEW": return "clientReview";
    case "APPROVED": {
      const needsCover = isVideo && !i.coverDriveUrl && !i.coverWaived;
      const needsCoverApproval = isVideo && !!i.coverDriveUrl && !i.coverApproved && !i.coverWaived;
      if (needsCover) return "criarCapa";
      if (needsCoverApproval) return "aprovarCapa";
      return "readyToSchedule";
    }
    case "SCHEDULED":
    case "PUBLISHED": return "published";
    default: return "draft";
  }
}

const rows = await p.contentItem.findMany({
  where: { stageKey: null },
  select: {
    id: true, status: true, contentType: true, fileType: true, coverDriveUrl: true, coverWaived: true,
    coverApproved: true, createdAt: true, clientReviewAt: true,
    approvalItem: { select: { status: true, reviewedAt: true } },
    internalReviewItem: { select: { status: true, reviewedAt: true } },
  },
});
console.log(`Posts sem stageKey: ${rows.length}${APPLY ? "  (GRAVANDO)" : "  (dry-run)"}\n`);

const counts = {};
for (const r of rows) {
  const stageKey = computeStageKey(r);
  const since = r.clientReviewAt ?? r.approvalItem?.reviewedAt ?? r.internalReviewItem?.reviewedAt ?? r.createdAt;
  counts[stageKey] = (counts[stageKey] || 0) + 1;
  if (APPLY) await p.contentItem.update({ where: { id: r.id }, data: { stageKey, stageSince: since } });
}
console.log("Por etapa:", counts);
console.log(APPLY ? "GRAVADO" : "Dry-run concluído. Rode com --apply.");
await p.$disconnect();
