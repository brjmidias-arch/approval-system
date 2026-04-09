export type FileType = "IMAGE" | "VIDEO" | "PDF";
export type ContentType = "POST_FEED" | "CARROSSEL" | "REELS" | "STORIES";
export type ApprovalStatus = "PENDING" | "APPROVED" | "ADJUSTMENT" | "REJECTED";
export type CampaignStatus = "OPEN" | "CLOSED";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  POST_FEED: "Post Feed",
  CARROSSEL: "Carrossel",
  REELS: "Reels",
  STORIES: "Stories",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  ADJUSTMENT: "Ajuste",
  REJECTED: "Reprovado",
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING: "text-gray-400 bg-gray-800",
  APPROVED: "text-emerald-400 bg-emerald-900/30",
  ADJUSTMENT: "text-amber-400 bg-amber-900/30",
  REJECTED: "text-red-400 bg-red-900/30",
};
