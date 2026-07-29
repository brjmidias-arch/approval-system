import { prisma } from "@/lib/prisma";
import { notifyTelegram, tgEscape } from "@/lib/telegram";

export type StepItem = {
  status: string;
  contentType: string;
  fileType: string;
  coverDriveUrl: string | null;
  coverWaived: boolean;
  coverApproved: boolean;
  approvalItem: { status: string } | null;
  internalReviewItem: { status: string } | null;
};

/** Rótulo do próximo passo a partir do estado do post (espelha as etapas do dashboard). */
export function nextStepLabel(i: StepItem): string | null {
  const isVideo = i.contentType === "REELS" || i.fileType === "VIDEO";
  const a = i.approvalItem?.status;
  const r = i.internalReviewItem?.status;
  const needsAdjustment = a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED";
  if (needsAdjustment) return "✏️ Precisa de ajuste";
  switch (i.status) {
    case "INTERNAL_REVIEW":
    case "INTERNAL_DONE":
      return "🔍 Aguardando revisão interna";
    case "CLIENT_REVIEW":
      return "👤 Aguardando aprovação do cliente";
    case "APPROVED":
      if (isVideo && !i.coverDriveUrl && !i.coverWaived) return "🎨 Precisa criar a capa";
      if (isVideo && i.coverDriveUrl && !i.coverApproved && !i.coverWaived) return "🖼️ Capa aguardando aprovação";
      return "📅 Pronto para programar";
    case "SCHEDULED":
      return "🗓️ Programado";
    default:
      return null; // DRAFT/PUBLISHED
  }
}

/**
 * Avisa no Telegram o PRÓXIMO PASSO de um post. `prefix` opcional descreve o que
 * acabou de acontecer (ex.: "✅ Cliente aprovou"). Best-effort.
 */
export async function notifyNextStep(contentItemId: string, prefix?: string): Promise<void> {
  try {
    const i = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        title: true, status: true, contentType: true, fileType: true,
        coverDriveUrl: true, coverWaived: true, coverApproved: true,
        client: { select: { name: true } },
        approvalItem: { select: { status: true } },
        internalReviewItem: { select: { status: true } },
      },
    });
    if (!i) return;
    const label = nextStepLabel(i);
    if (!label && !prefix) return;
    const head = [prefix, label].filter(Boolean).join(" → ");
    await notifyTelegram(`${head}\nCliente: ${tgEscape(i.client?.name)}\nPost: ${tgEscape(i.title || "(sem título)")}`);
  } catch {
    // best-effort
  }
}

const ORDER = [
  "✏️ Precisa de ajuste",
  "🎨 Precisa criar a capa",
  "🖼️ Capa aguardando aprovação",
  "🔍 Aguardando revisão interna",
  "👤 Aguardando aprovação do cliente",
  "📅 Pronto para programar",
  "🗓️ Programado",
];

/**
 * Envia um digest no Telegram com todas as pendências agrupadas pelo próximo passo
 * (ex.: quantos aguardam o cliente, quantos precisam de capa). Best-effort.
 */
export async function sendPendingDigest(): Promise<number> {
  try {
    const items = await prisma.contentItem.findMany({
      where: { status: { in: ["INTERNAL_REVIEW", "INTERNAL_DONE", "CLIENT_REVIEW", "APPROVED"] } },
      select: {
        status: true, contentType: true, fileType: true,
        coverDriveUrl: true, coverWaived: true, coverApproved: true,
        client: { select: { name: true } },
        approvalItem: { select: { status: true } },
        internalReviewItem: { select: { status: true } },
      },
    });
    const groups = new Map<string, string[]>();
    for (const i of items) {
      const label = nextStepLabel(i);
      if (!label) continue;
      const arr = groups.get(label) ?? [];
      arr.push(i.client?.name || "?");
      groups.set(label, arr);
    }
    if (groups.size === 0) return 0;
    const labels = Array.from(groups.keys()).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    let msg = "⏰ <b>Lembrete diário — pendências</b>";
    for (const label of labels) {
      const clients = groups.get(label)!;
      const counts = new Map<string, number>();
      for (const c of clients) counts.set(c, (counts.get(c) ?? 0) + 1);
      const detalhe = Array.from(counts.entries()).map(([c, n]) => `${tgEscape(c)}${n > 1 ? ` (${n})` : ""}`).join(", ");
      msg += `\n\n${label}: <b>${clients.length}</b>\n${detalhe}`;
    }
    await notifyTelegram(msg);
    return labels.length;
  } catch {
    return 0;
  }
}
