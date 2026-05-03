export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ProgramacaoKanban, { type ClientData, type Post } from "@/components/admin/ProgramacaoKanban";

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
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

  function getApprovedPosts(campaign: CampaignWithItems): Post[] {
    const seen = new Set<string>();
    const posts: Post[] = [];

    for (const item of campaign.contentItems) {
      if (item.approvalItem?.status !== "APPROVED") continue;
      if (item.contentType === "TEXTO") continue;

      const base = {
        campaignId: campaign.id,
        campaignName: campaign.name,
        approvedAt: item.approvalItem.reviewedAt?.toISOString() ?? null,
        postedAt: item.postedAt?.toISOString() ?? null,
        scheduledDate: item.scheduledDate?.toISOString() ?? null,
      };

      if (item.contentType === "CARROSSEL" && item.groupId) {
        if (seen.has(item.groupId)) continue;
        seen.add(item.groupId);
        posts.push({
          id: item.id,
          groupId: item.groupId,
          title: item.title,
          caption: item.caption,
          driveUrl: item.driveUrl,
          coverUrl: item.coverUrl,
          coverDriveUrl: item.coverDriveUrl,
          contentType: item.contentType,
          fileType: item.fileType,
          fileUrl: item.fileUrl,
          ...base,
        });
      } else if (item.contentType !== "CARROSSEL") {
        posts.push({
          id: item.id,
          groupId: null,
          title: item.title,
          caption: item.caption,
          driveUrl: item.driveUrl,
          coverUrl: item.coverUrl,
          coverDriveUrl: item.coverDriveUrl,
          contentType: item.contentType,
          fileType: item.fileType,
          fileUrl: item.fileUrl,
          ...base,
        });
      }
    }
    return posts;
  }

  // Build per-client data
  const clientMap = new Map<string, { clientId: string; clientName: string; posts: Post[] }>();

  for (const campaign of campaigns) {
    const posts = getApprovedPosts(campaign);
    if (posts.length === 0) continue;
    const { id: clientId, name: clientName } = campaign.client;
    if (!clientMap.has(clientId)) clientMap.set(clientId, { clientId, clientName, posts: [] });
    clientMap.get(clientId)!.posts.push(...posts);
  }

  const now = new Date();

  const clients: ClientData[] = Array.from(clientMap.values())
    .map((c) => {
      const pending = c.posts.filter((p) => !p.scheduledDate && !p.postedAt);
      const maxDaysWaiting = pending.reduce((max, p) => {
        if (!p.approvedAt) return max;
        const days = Math.floor(
          (now.getTime() - new Date(p.approvedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        return Math.max(max, days);
      }, 0);
      return { ...c, maxDaysWaiting };
    })
    .sort((a, b) => b.maxDaysWaiting - a.maxDaysWaiting);

  // Pendentes = any post without postedAt; Concluídos = all posts have postedAt
  const pendingClients = clients.filter((c) => c.posts.some((p) => !p.postedAt));
  const doneClients    = clients.filter((c) => c.posts.length > 0 && c.posts.every((p) => p.postedAt));

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
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "pendentes" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Pendentes{" "}
          {pendingClients.length > 0 && (
            <span className="ml-1 text-xs opacity-60">{pendingClients.length}</span>
          )}
        </Link>
        <Link
          href="/admin/programacao?tab=concluidos"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "concluidos" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Concluídos{" "}
          {doneClients.length > 0 && (
            <span className="ml-1 text-xs opacity-60">{doneClients.length}</span>
          )}
        </Link>
      </div>

      {tab === "pendentes" ? (
        <ProgramacaoKanban clients={pendingClients} now={now.toISOString()} />
      ) : (
        <div className="space-y-3">
          {doneClients.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">
                Nenhum cliente com todos os posts publicados ainda.
              </p>
            </div>
          ) : (
            doneClients.map((client) => (
              <div
                key={client.clientId}
                className="bg-[#1a1a1a] border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-white font-semibold">{client.clientName}</p>
                  <p className="text-gray-500 text-xs">
                    {client.posts.filter((p) => p.postedAt).length} posts publicados
                  </p>
                </div>
                <span className="text-xs text-emerald-400 bg-emerald-900/20 px-3 py-1 rounded-full">
                  ✅ Concluído
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
