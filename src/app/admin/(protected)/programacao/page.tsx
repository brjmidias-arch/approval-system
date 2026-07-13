export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ProgramacaoKanban, { type CampaignData } from "@/components/admin/ProgramacaoKanban";
import { getSchedulablePosts } from "@/lib/programacao";

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === "concluidos" ? "concluidos" : "pendentes";

  const campaigns = await prisma.campaign.findMany({
    where: {
      OR: [
        { status: { in: ["CLOSED", "PUBLISHED"] } },
        { contentItems: { some: { sentToProgramacaoAt: { not: null } } } },
      ],
    },
    include: {
      client: true,
      approvalItems: true,
      contentItems: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          contentType: true,
          groupId: true,
          title: true,
          caption: true,
          fileUrl: true,
          fileType: true,
          coverUrl: true,
          coverDriveUrl: true,
          driveUrl: true,
          scheduledDate: true,
          postedAt: true,
          sentToProgramacaoAt: true,
          internalReviewItem: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  // One entry per campaign (matches dashboard structure)
  const allCampaignData: CampaignData[] = campaigns
    .map((campaign) => {
      const posts = getSchedulablePosts(campaign);
      if (posts.length === 0) return null;
      const unscheduled = posts.filter((p) => !p.scheduledDate && !p.postedAt);
      const maxDaysWaiting = unscheduled.reduce((max, p) => {
        if (!p.approvedAt) return max;
        return Math.max(
          max,
          Math.floor((now.getTime() - new Date(p.approvedAt).getTime()) / (1000 * 60 * 60 * 24))
        );
      }, 0);
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        clientId: campaign.clientId,
        clientName: campaign.client.name,
        posts,
        maxDaysWaiting,
      };
    })
    .filter((c): c is CampaignData => c !== null)
    .sort((a, b) => b.maxDaysWaiting - a.maxDaysWaiting);

  const pendingCampaigns = allCampaignData.filter((c) => c.posts.some((p) => !p.postedAt));
  const doneCampaigns = allCampaignData.filter((c) => c.posts.length > 0 && c.posts.every((p) => p.postedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Programação</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {pendingCampaigns.length > 0
            ? `${pendingCampaigns.length} ${pendingCampaigns.length === 1 ? "campanha" : "campanhas"} com posts para agendar`
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
          {pendingCampaigns.length > 0 && (
            <span className="ml-1 text-xs opacity-60">{pendingCampaigns.length}</span>
          )}
        </Link>
        <Link
          href="/admin/programacao?tab=concluidos"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "concluidos" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Concluídos{" "}
          {doneCampaigns.length > 0 && (
            <span className="ml-1 text-xs opacity-60">{doneCampaigns.length}</span>
          )}
        </Link>
      </div>

      {tab === "pendentes" ? (
        <ProgramacaoKanban campaigns={pendingCampaigns} now={now.toISOString()} />
      ) : (
        <div className="space-y-3">
          {doneCampaigns.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">
                Nenhuma campanha com todos os posts publicados ainda.
              </p>
            </div>
          ) : (
            doneCampaigns.map((c) => (
              <div
                key={c.campaignId}
                className="bg-[#1a1a1a] border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-white font-semibold">{c.clientName}</p>
                  <p className="text-gray-500 text-xs">
                    {c.campaignName} · {c.posts.filter((p) => p.postedAt).length} posts publicados
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
