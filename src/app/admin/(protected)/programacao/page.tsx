export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import ClientScheduleAccordion from "@/components/admin/ClientScheduleAccordion";

export default async function ProgramacaoPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      client: true,
      contentItems: {
        orderBy: { order: "asc" },
        include: { approvalItem: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  type CampaignWithItems = (typeof campaigns)[0];

  function getApprovedGroups(campaign: CampaignWithItems) {
    const seenGroupIds = new Set<string>();
    const groups: {
      id: string;
      groupId: string | null;
      title: string | null;
      caption: string | null;
      driveUrl: string | null;
      coverUrl: string | null;
      coverDriveUrl: string | null;
      scheduledDate: Date | null;
      contentType: string;
      fileType: string;
      fileUrl: string;
    }[] = [];

    for (const item of campaign.contentItems) {
      if (item.approvalItem?.status !== "APPROVED") continue;

      if (item.contentType === "CARROSSEL" && item.groupId) {
        if (seenGroupIds.has(item.groupId)) continue;
        seenGroupIds.add(item.groupId);
        groups.push({
          id: item.id,
          groupId: item.groupId,
          title: item.title,
          caption: item.caption,
          driveUrl: item.driveUrl,
          coverUrl: item.coverUrl,
          coverDriveUrl: item.coverDriveUrl,
          scheduledDate: item.scheduledDate,
          contentType: item.contentType,
          fileType: item.fileType,
          fileUrl: item.fileUrl,
        });
      } else if (item.contentType !== "CARROSSEL") {
        groups.push({
          id: item.id,
          groupId: null,
          title: item.title,
          caption: item.caption,
          driveUrl: item.driveUrl,
          coverUrl: item.coverUrl,
          coverDriveUrl: item.coverDriveUrl,
          scheduledDate: item.scheduledDate,
          contentType: item.contentType,
          fileType: item.fileType,
          fileUrl: item.fileUrl,
        });
      }
    }

    return groups;
  }

  // Group by client
  const clientMap = new Map<string, {
    clientId: string;
    clientName: string;
    campaigns: { id: string; name: string; month: number; year: number; posts: ReturnType<typeof getApprovedGroups> }[];
  }>();

  for (const campaign of campaigns) {
    const posts = getApprovedGroups(campaign);
    if (posts.length === 0) continue;

    const { id: clientId, name: clientName } = campaign.client;

    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, { clientId, clientName, campaigns: [] });
    }

    clientMap.get(clientId)!.campaigns.push({
      id: campaign.id,
      name: campaign.name,
      month: campaign.month,
      year: campaign.year,
      posts,
    });
  }

  const clients = Array.from(clientMap.values()).map((c) => ({
    ...c,
    totalPosts: c.campaigns.reduce((acc, camp) => acc + camp.posts.length, 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Programação</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {clients.length > 0
            ? `${clients.length} ${clients.length === 1 ? "cliente" : "clientes"} com posts aprovados`
            : "Posts aprovados prontos para agendar"}
        </p>
      </div>

      <ClientScheduleAccordion clients={clients} />
    </div>
  );
}
