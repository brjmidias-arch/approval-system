/**
 * Preview do feed do Instagram: monta os "tiles" (1 por post; carrossel = 1) a
 * partir dos ContentItems. Só visualização — não altera nenhum status.
 */
import { extractDriveId, driveThumbUrl } from "@/lib/drive";

export type FeedStatus = "pending" | "approved" | "adjustment" | "rejected" | "published" | "internal" | "draft";

export type FeedSlide = { img: string | null; isVideo: boolean; openUrl: string | null };

export type FeedEntry = {
  key: string;
  title: string | null;
  contentType: string;
  isVideo: boolean;
  thumb: string | null;
  slides: FeedSlide[];
  caption: string | null;
  scheduledDate: string | null;
  status: FeedStatus;
};

/** Campos do ContentItem usados no feed (select do Prisma). */
export const FEED_SELECT = {
  id: true, groupId: true, order: true, contentType: true, fileType: true, fileUrl: true,
  driveUrl: true, coverUrl: true, title: true, caption: true, scheduledDate: true, status: true,
  approvalItem: { select: { status: true } },
  internalReviewItem: { select: { status: true } },
} as const;

export type FeedRow = {
  id: string;
  groupId: string | null;
  order: number;
  contentType: string;
  fileType: string;
  fileUrl: string;
  driveUrl: string | null;
  coverUrl: string | null;
  title: string | null;
  caption: string | null;
  scheduledDate: Date | null;
  status: string;
  approvalItem: { status: string } | null;
  internalReviewItem: { status: string } | null;
};

/** Miniatura de vídeo do Drive (o fileUrl de vídeo é o player, não uma imagem). */
function videoThumb(r: FeedRow): string | null {
  const id = extractDriveId(r.fileUrl || "") ?? (r.driveUrl ? extractDriveId(r.driveUrl) : null);
  return id ? driveThumbUrl(id) : null;
}

function slideOf(r: FeedRow): FeedSlide {
  const isVideo = r.fileType === "VIDEO";
  if (isVideo) return { img: r.coverUrl || videoThumb(r), isVideo: true, openUrl: r.driveUrl ?? r.fileUrl };
  if (r.fileType === "IMAGE") return { img: r.fileUrl || null, isVideo: false, openUrl: r.driveUrl };
  return { img: null, isVideo: false, openUrl: r.driveUrl ?? r.fileUrl };
}

/**
 * Status do tile. Para o cliente, só o que ele já viu (a revisão interna não aparece:
 * post que voltou para a equipe depois do pedido dele conta como "em ajuste").
 */
function statusOf(r: FeedRow, audience: "client" | "internal"): FeedStatus {
  const a = r.approvalItem?.status;
  const i = r.internalReviewItem?.status;
  if (r.status === "PUBLISHED") return "published";
  if (r.status === "APPROVED" || r.status === "SCHEDULED") return "approved";
  if (a === "REJECTED") return "rejected";
  if (a === "ADJUSTMENT") return "adjustment";
  if (r.status === "CLIENT_REVIEW") return "pending";
  if (audience === "client") return "adjustment";
  if (i === "REJECTED") return "rejected";
  if (i === "ADJUSTMENT") return "adjustment";
  if (r.status === "DRAFT") return "draft";
  return "internal";
}

/** Agrupa os slides de carrossel e devolve 1 entrada por post (ordem: data mais futura primeiro). */
export function buildFeed(rows: FeedRow[], audience: "client" | "internal"): FeedEntry[] {
  const groups = new Map<string, FeedRow[]>();
  for (const r of rows) {
    const key = r.contentType === "CARROSSEL" && r.groupId ? r.groupId : r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: FeedEntry[] = [];
  for (const [key, list] of Array.from(groups.entries())) {
    list.sort((a, b) => a.order - b.order);
    const rep = list[0];
    const slides = list.map(slideOf);
    const isVideo = rep.contentType === "REELS" || rep.fileType === "VIDEO";
    out.push({
      key,
      title: rep.title,
      contentType: rep.contentType,
      isVideo,
      // Carrossel = 1ª imagem; vídeo/reels = capa (ou miniatura do vídeo).
      thumb: isVideo ? rep.coverUrl || slides[0].img : slides[0].img ?? rep.coverUrl,
      slides,
      caption: rep.caption,
      scheduledDate: rep.scheduledDate ? rep.scheduledDate.toISOString() : null,
      status: statusOf(rep, audience),
    });
  }
  return out.sort((a, b) => {
    if (a.scheduledDate === b.scheduledDate) return 0;
    if (!a.scheduledDate) return 1;
    if (!b.scheduledDate) return -1;
    return a.scheduledDate < b.scheduledDate ? 1 : -1;
  });
}

/** Início da janela do feed (posts com data a partir de ~4 meses atrás). */
export function feedFromDate(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 120);
  return d;
}
