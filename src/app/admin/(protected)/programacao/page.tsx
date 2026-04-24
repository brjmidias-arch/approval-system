export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ClientScheduleAccordion from "@/components/admin/ClientScheduleAccordion";

export default async function ProgramacaoPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "concluidos" ? "concluidos" : "pendentes";
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
      approvedAt: Date | null;
      postedAt: Date | null;
      campaignId: string;
    }[] = [];

    for (const item of campaign.contentItems) {
      if (item.approvalItem?.status !== "APPROVED") continue;

      const base = {
        approvedAt: item.approvalItem.reviewedAt,
        postedAt: item.postedAt,
        campaignId: campaign.id,
      };

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
          ...base,
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
          ...base,
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

  const now = new Date();

  const clients = Array.from(clientMap.values()).map((c) => {
    const allPosts = c.campaigns.flatMap((camp) => camp.posts);
    // "pending" = approved but not yet scheduled in planner (and not posted)
    const pendingPosts = allPosts.filter((p) => !p.scheduledDate && !p.postedAt);
    const totalPosts = allPosts.length;
    const scheduledPosts = allPosts.filter((p) => p.scheduledDate && !p.postedAt).length;
    const postedPosts = allPosts.filter((p) => p.postedAt).length;

    // Max days waiting: oldest unscheduled approved post
    const maxDaysWaiting = pendingPosts.reduce((max, p) => {
      if (!p.approvedAt) return max;
      const days = Math.floor((now.getTime() - new Date(p.approvedAt).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(max, days);
    }, 0);

    return {
      ...c,
      totalPosts,
      scheduledPosts,
      postedPosts,
      pendingPosts: pendingPosts.length,
      maxDaysWaiting,
    };
  }).sort((a, b) => b.maxDaysWaiting - a.maxDaysWaiting);

  const pendingClients = clients.filter((c) => c.pendingPosts > 0);
  const doneClients = clients.filter((c) => c.pendingPosts === 0);
  const displayClients = tab === "concluidos" ? doneClients : pendingClients;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Programação</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {pendingClients.length > 0
            ? `${pendingClients.length} ${pendingClients.length === 1 ? "cliente" : "clientes"} com posts para agendar`
            : "Nenhum post pendente de agendamento"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <Link
          href="/admin/programacao"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "pendentes" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
        >
          Pendentes {pendingClients.length > 0 && <span className="ml-1 text-xs opacity-60">{pendingClients.length}</span>}
        </Link>
        <Link
          href="/admin/programacao?tab=concluidos"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "concluidos" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
        >
          Concluídos {doneClients.length > 0 && <span className="ml-1 text-xs opacity-60">{doneClients.length}</span>}
        </Link>
      </div>

      <ClientScheduleAccordion clients={displayClients} />
    </div>
  );
}
