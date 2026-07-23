export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ProgramacaoKanban, { type CampaignData } from "@/components/admin/ProgramacaoKanban";
import type { SchedulablePost } from "@/lib/programacao";

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === "concluidos" ? "concluidos" : "pendentes";

  // Post-based query (client-direct posts have campaignId = null, so we can't
  // start from Campaign anymore). Covers both legacy campaign-linked posts
  // (backfilled with clientId in fase1) and new client-direct posts.
  const items = await prisma.contentItem.findMany({
    where: {
      status: "APPROVED",
      postedAt: null,
      contentType: { not: "TEXTO" },
      OR: [
        { sentToProgramacaoAt: { not: null } },
        { campaign: { status: { in: ["CLOSED", "PUBLISHED"] } } },
      ],
    },
    orderBy: { order: "asc" },
    select: {
      id: true,
      clientId: true,
      groupId: true,
      contentType: true,
      title: true,
      caption: true,
      fileUrl: true,
      fileType: true,
      coverUrl: true,
      coverDriveUrl: true,
      driveUrl: true,
      scheduledDate: true,
      postedAt: true,
      client: { select: { id: true, name: true } },
      approvalItem: { select: { reviewedAt: true } },
    },
  });

  const now = new Date();

  // Dedupe carousels (one post per groupId, representative = first by `order`
  // since the query is already ordered), group posts by client.
  const seen = new Set<string>();
  const byClient = new Map<string, { clientId: string; clientName: string; posts: SchedulablePost[] }>();

  for (const item of items) {
    if (!item.client) continue; // safety net: every item should be backfilled with a client

    const dedupeKey = item.contentType === "CARROSSEL" && item.groupId ? item.groupId : item.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const post: SchedulablePost = {
      id: item.id,
      campaignId: item.client.id,
      campaignName: item.client.name,
      title: item.title,
      contentType: item.contentType,
      fileType: item.fileType,
      fileUrl: item.fileUrl,
      coverUrl: item.coverUrl,
      coverDriveUrl: item.coverDriveUrl,
      caption: item.caption,
      driveUrl: item.driveUrl,
      groupId: item.groupId,
      scheduledDate: item.scheduledDate?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      approvedAt: item.approvalItem?.reviewedAt?.toISOString() ?? null,
    };

    const entry = byClient.get(item.client.id);
    if (entry) {
      entry.posts.push(post);
    } else {
      byClient.set(item.client.id, {
        clientId: item.client.id,
        clientName: item.client.name,
        posts: [post],
      });
    }
  }

  // One entry per client
  const allCampaignData: CampaignData[] = Array.from(byClient.values())
    .map(({ clientId, clientName, posts }) => {
      const unscheduled = posts.filter((p) => !p.scheduledDate && !p.postedAt);
      const maxDaysWaiting = unscheduled.reduce((max, p) => {
        if (!p.approvedAt) return max;
        return Math.max(
          max,
          Math.floor((now.getTime() - new Date(p.approvedAt).getTime()) / (1000 * 60 * 60 * 24))
        );
      }, 0);
      return {
        campaignId: clientId,
        campaignName: clientName,
        clientId,
        clientName,
        posts,
        maxDaysWaiting,
      };
    })
    .sort((a, b) => b.maxDaysWaiting - a.maxDaysWaiting);

  const pendingCampaigns = allCampaignData.filter((c) => c.posts.some((p) => !p.postedAt));
  const doneCampaigns = allCampaignData.filter((c) => c.posts.length > 0 && c.posts.every((p) => p.postedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Programação</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {pendingCampaigns.length > 0
            ? `${pendingCampaigns.length} ${pendingCampaigns.length === 1 ? "cliente" : "clientes"} com posts para agendar`
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
                Nenhum cliente com todos os posts publicados ainda.
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
                    {c.posts.filter((p) => p.postedAt).length} posts publicados
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
