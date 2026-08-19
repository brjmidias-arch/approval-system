// Seleção compartilhada de posts da Programação — usada pela página admin e pela
// API pública por cliente, para ambas aplicarem exatamente a mesma regra.

export interface SchedulablePost {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  coverUrl: string | null;
  coverDriveUrl: string | null;
  caption: string | null;
  driveUrl: string | null;
  groupId: string | null;
  scheduledDate: string | null; // = previsão de postagem (vem do Roteirização)
  agendadoDate?: string | null; // = data em que foi agendada (preenchida no /programar)
  postedAt: string | null;
  approvedAt: string | null;
}

export interface SchedulableInputCampaign {
  id: string;
  name: string;
  status: string;
  approvalItems: { contentItemId: string; status: string; reviewedAt: Date | null }[];
  contentItems: {
    id: string;
    contentType: string;
    groupId: string | null;
    title: string | null;
    caption: string | null;
    fileUrl: string;
    fileType: string;
    coverUrl: string | null;
    coverDriveUrl: string | null;
    driveUrl: string | null;
    scheduledDate: Date | null;
    postedAt: Date | null;
    sentToProgramacaoAt: Date | null;
    internalReviewItem: { status: string } | null;
  }[];
}

/**
 * Posts aprovados e liberados para a Programação (carrossel = 1 post, pelo primeiro slide).
 * NÃO filtra por postedAt — cada chamador decide se quer só os não-postados.
 */
export function getSchedulablePosts(campaign: SchedulableInputCampaign): SchedulablePost[] {
  const seen = new Set<string>();
  const posts: SchedulablePost[] = [];

  for (const item of campaign.contentItems) {
    if (item.contentType === "TEXTO") continue;
    // Exclui itens escondidos do cliente pela revisão interna
    if (item.internalReviewItem && item.internalReviewItem.status !== "APPROVED") continue;
    const approval = campaign.approvalItems.find((a) => a.contentItemId === item.id);
    if (approval?.status !== "APPROVED") continue;
    // Só entra na Programação se a campanha está fechada/publicada OU foi enviado explicitamente.
    const campaignReleased = campaign.status === "CLOSED" || campaign.status === "PUBLISHED";
    if (!campaignReleased && !item.sentToProgramacaoAt) continue;

    const base = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      approvedAt: approval.reviewedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      scheduledDate: item.scheduledDate?.toISOString() ?? null,
    };

    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seen.has(item.groupId)) continue;
      seen.add(item.groupId);
      posts.push({
        id: item.id, groupId: item.groupId, title: item.title, caption: item.caption,
        driveUrl: item.driveUrl, coverUrl: item.coverUrl, coverDriveUrl: item.coverDriveUrl,
        contentType: item.contentType, fileType: item.fileType, fileUrl: item.fileUrl, ...base,
      });
    } else if (item.contentType !== "CARROSSEL") {
      posts.push({
        id: item.id, groupId: null, title: item.title, caption: item.caption,
        driveUrl: item.driveUrl, coverUrl: item.coverUrl, coverDriveUrl: item.coverDriveUrl,
        contentType: item.contentType, fileType: item.fileType, fileUrl: item.fileUrl, ...base,
      });
    }
  }
  return posts;
}
