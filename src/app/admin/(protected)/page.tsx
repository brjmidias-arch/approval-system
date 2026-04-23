export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ChargeButton from "@/components/admin/ChargeButton";
import AutoRefresh from "@/components/admin/AutoRefresh";

function getStatusCounts(campaign: {
  status: string;
  approvalItems: { status: string; contentItemId: string }[];
  contentItems: { id: string; groupId: string | null; contentType: string }[];
}) {
  const seenGroupIds = new Set<string>();
  const posts: { id: string; groupId: string | null }[] = [];
  for (const item of campaign.contentItems) {
    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seenGroupIds.has(item.groupId)) continue;
      seenGroupIds.add(item.groupId);
      posts.push({ id: item.id, groupId: item.groupId });
    } else {
      posts.push({ id: item.id, groupId: null });
    }
  }

  const getPostStatus = (post: { id: string; groupId: string | null }) => {
    if (post.groupId) {
      const groupItems = campaign.contentItems.filter((c) => c.groupId === post.groupId);
      const approval = campaign.approvalItems.find((a) => a.contentItemId === groupItems[0]?.id);
      return approval?.status || "PENDING";
    }
    const approval = campaign.approvalItems.find((a) => a.contentItemId === post.id);
    return approval?.status || "PENDING";
  };

  const total = posts.length;
  const approved = posts.filter((p) => getPostStatus(p) === "APPROVED").length;
  const adjustment = posts.filter((p) => getPostStatus(p) === "ADJUSTMENT").length;
  const rejected = posts.filter((p) => getPostStatus(p) === "REJECTED").length;
  const pending = total - approved - adjustment - rejected;
  const clientFinished = campaign.status === "CLOSED" && total > 0;
  const allReviewed = total > 0 && pending === 0;

  return { total, approved, adjustment, rejected, pending, clientFinished, allReviewed };
}

export default async function AdminDashboard({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "concluidas" ? "concluidas" : "ativas";
  const clients = await prisma.client.findMany({
    include: {
      campaigns: {
        include: {
          approvalItems: true,
          contentItems: { select: { id: true, groupId: true, contentType: true, scheduledDate: true, postedAt: true, internalReviewItem: { select: { status: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });



  const totalClients = clients.length;
  const totalCampaigns = clients.reduce((acc, c) => acc + c.campaigns.length, 0);
  const openCampaigns = clients.reduce(
    (acc, c) => acc + c.campaigns.filter((cam) => cam.status === "OPEN").length,
    0
  );
  const internalReviewCampaigns = clients.reduce(
    (acc, c) => acc + c.campaigns.filter((cam) => cam.status === "INTERNAL_REVIEW" || cam.status === "INTERNAL_DONE").length,
    0
  );
  const awaitingAction = clients.reduce(
    (acc, c) =>
      acc + c.campaigns.filter((cam) => {
        const counts = getStatusCounts(cam);
        return cam.status === "CLOSED" && counts.total > 0;
      }).length,
    0
  );

  // Flatten all campaigns with client info
  const allCampaigns = clients.flatMap((client) =>
    client.campaigns.map((campaign) => ({ campaign, client }))
  );

  // Sort by urgency — highest priority first
  const sortedCampaigns = [...allCampaigns].sort((a, b) => {
    function urgency(cam: typeof a.campaign) {
      const counts = getStatusCounts(cam);
      const internalItems = cam.contentItems ?? [];
      const hasInternalAdjustment = internalItems.some(
        (i: { internalReviewItem?: { status: string } | null }) =>
          i.internalReviewItem?.status === "ADJUSTMENT" || i.internalReviewItem?.status === "REJECTED"
      );
      const hasClientAdjustment = counts.adjustment > 0 || counts.rejected > 0;
      const isFullyApproved = counts.total > 0 && counts.approved === counts.total;
      const daysSince = Math.floor((Date.now() - new Date(cam.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      if (cam.status === "INTERNAL_DONE" && hasInternalAdjustment) return 5000 + daysSince;
      if (cam.status === "CLOSED" && hasClientAdjustment) return 4000 + daysSince;
      if (cam.status === "CLOSED" && isFullyApproved) return 3000 + daysSince;
      if (cam.status === "CLOSED") return 2000 + daysSince;
      if (cam.status === "OPEN" && counts.pending > 0) return 1000 + daysSince;
      if (cam.status === "INTERNAL_REVIEW" || cam.status === "INTERNAL_DONE") return 500 + daysSince;
      if (cam.status === "DRAFT") return 100 + daysSince;
      return daysSince;
    }
    return urgency(b.campaign) - urgency(a.campaign);
  });

  const activeCampaigns = sortedCampaigns.filter(({ campaign }) => campaign.status !== "PUBLISHED");
  const publishedCampaigns = sortedCampaigns.filter(({ campaign }) => campaign.status === "PUBLISHED");
  const displayCampaigns = tab === "concluidas" ? publishedCampaigns : activeCampaigns;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60000} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <Link
          href="/admin/clients"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Cliente
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Clientes</p>
          <p className="text-3xl font-bold text-white mt-1">{totalClients}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Campanhas</p>
          <p className="text-3xl font-bold text-white mt-1">{totalCampaigns}</p>
        </div>
        <div className={`border rounded-xl p-4 ${internalReviewCampaigns > 0 ? "bg-violet-900/20 border-violet-500/30" : "bg-[#1a1a1a] border-white/10"}`}>
          <p className="text-gray-400 text-xs uppercase tracking-wider">Revisão Interna</p>
          <p className={`text-3xl font-bold mt-1 ${internalReviewCampaigns > 0 ? "text-violet-400" : "text-white"}`}>{internalReviewCampaigns}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Em Aberto</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{openCampaigns}</p>
        </div>
        <div className={`border rounded-xl p-4 ${awaitingAction > 0 ? "bg-amber-900/20 border-amber-500/30" : "bg-[#1a1a1a] border-white/10"}`}>
          <p className="text-gray-400 text-xs uppercase tracking-wider">Aguardando Ação</p>
          <p className={`text-3xl font-bold mt-1 ${awaitingAction > 0 ? "text-amber-400" : "text-white"}`}>{awaitingAction}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <Link
          href="/admin"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "ativas" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
        >
          Ativas {activeCampaigns.length > 0 && <span className="ml-1 text-xs opacity-60">{activeCampaigns.length}</span>}
        </Link>
        <Link
          href="/admin?tab=concluidas"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "concluidas" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
        >
          Concluídas {publishedCampaigns.length > 0 && <span className="ml-1 text-xs opacity-60">{publishedCampaigns.length}</span>}
        </Link>
      </div>

      {/* Campaigns sorted by urgency */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
        {displayCampaigns.length === 0 ? (
          <div className="p-8 text-center">
            {tab === "concluidas" ? (
              <p className="text-gray-400">Nenhuma campanha concluída ainda.</p>
            ) : (
              <>
                <p className="text-gray-400">Nenhuma campanha ativa.</p>
                <Link href="/admin/clients" className="inline-block mt-3 text-emerald-400 hover:text-emerald-300 text-sm">
                  Cadastrar primeiro cliente →
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {displayCampaigns.map(({ campaign, client }) => {
              const counts = getStatusCounts(campaign);
              const daysSinceCreated = Math.floor(
                (Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24)
              );
              const daysSinceOpen = Math.floor(
                (Date.now() - new Date(campaign.expiresAt).getTime() + 24 * 60 * 60 * 1000) / (1000 * 60 * 60 * 24)
              );
              const hasAdjustment = counts.adjustment > 0 || counts.rejected > 0;
              const isFullyApproved = counts.total > 0 && counts.approved === counts.total;
              const clientFinished = campaign.status === "CLOSED" && counts.total > 0;
              const waitingClient = campaign.status === "OPEN" && counts.pending > 0;

              type BadgeType = "adjustment" | "approved" | "finished" | null;
              let badgeType: BadgeType = null;
              let rowBg = "";

              if (clientFinished && hasAdjustment) {
                badgeType = "adjustment";
                rowBg = "bg-amber-900/10";
              } else if (clientFinished && isFullyApproved) {
                badgeType = "approved";
                rowBg = "bg-emerald-900/10";
              } else if (clientFinished) {
                badgeType = "finished";
                rowBg = "bg-blue-900/10";
              }

              // Unscheduled approved posts
              const seenGroupIdsUnsched = new Set<string>();
              const unscheduledApproved = (campaign.contentItems ?? []).filter((item) => {
                if (item.postedAt) return false;
                if (item.scheduledDate) return false;
                if (item.contentType === "CARROSSEL" && item.groupId) {
                  if (seenGroupIdsUnsched.has(item.groupId)) return false;
                  seenGroupIdsUnsched.add(item.groupId);
                }
                const approval = campaign.approvalItems.find((a) => a.contentItemId === item.id);
                return approval?.status === "APPROVED";
              });
              const unscheduledCount = unscheduledApproved.length;
              const maxDaysUnscheduled = unscheduledApproved.reduce((max, item) => {
                const approval = campaign.approvalItems.find((a) => a.contentItemId === item.id);
                if (!approval?.reviewedAt) return max;
                const days = Math.floor((Date.now() - new Date(approval.reviewedAt).getTime()) / (1000 * 60 * 60 * 24));
                return Math.max(max, days);
              }, 0);

              // Internal review adjustment check
              const internalItemsRow = campaign.contentItems ?? [];
              const hasInternalAdjustmentRow = internalItemsRow.some(
                (i: { internalReviewItem?: { status: string } | null }) =>
                  i.internalReviewItem?.status === "ADJUSTMENT" || i.internalReviewItem?.status === "REJECTED"
              );
              const pendingInternalCount = internalItemsRow.filter(
                (i: { internalReviewItem?: { status: string } | null }) =>
                  i.internalReviewItem?.status === "PENDING"
              ).length;

              // Row background + border based on urgency
              if (campaign.status === "INTERNAL_DONE" && hasInternalAdjustmentRow) {
                rowBg = "bg-amber-900/10";
              }

              let borderColor = "border-l-white/5";
              if (campaign.status === "INTERNAL_DONE" && hasInternalAdjustmentRow) borderColor = "border-l-amber-500";
              else if (clientFinished && hasAdjustment) borderColor = "border-l-amber-500";
              else if (clientFinished && isFullyApproved) borderColor = "border-l-emerald-500";
              else if (clientFinished) borderColor = "border-l-blue-500";
              else if (waitingClient) borderColor = "border-l-white/20";
              else if (campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE") borderColor = "border-l-violet-500";

              return (
                <Link
                  key={campaign.id}
                  href={`/admin/campaigns/${campaign.id}`}
                  className={`pl-4 pr-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors block border-l-2 ${borderColor} ${rowBg}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{client.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      {campaign.name}
                      <span className="text-gray-600"> · </span>
                      {counts.total} {counts.total === 1 ? "post" : "posts"}
                      {waitingClient && (
                        <span className={`ml-1.5 font-medium ${daysSinceCreated >= 3 ? "text-red-400" : "text-amber-400"}`}>
                          · {daysSinceCreated === 0 ? "enviado hoje" : daysSinceCreated === 1 ? "há 1 dia" : `há ${daysSinceCreated} dias`} sem aprovação
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs shrink-0">
                    {badgeType === "adjustment" && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-900/30 border border-amber-500/30 px-2.5 py-1 rounded-full animate-pulse">
                        ⚠️ Revisar ajustes
                      </span>
                    )}
                    {badgeType === "approved" && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                        ✅ Tudo aprovado — publicar
                      </span>
                    )}
                    {badgeType === "finished" && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 bg-blue-900/30 border border-blue-500/30 px-2.5 py-1 rounded-full">
                        📋 Cliente finalizou revisão
                      </span>
                    )}
                    {pendingInternalCount > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-violet-400 bg-violet-900/30 border border-violet-500/30 px-2.5 py-1 rounded-full animate-pulse">
                        🔍 {pendingInternalCount} revisão interna
                      </span>
                    )}
                    {unscheduledCount > 0 && (
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        maxDaysUnscheduled >= 7 ? "text-red-400 bg-red-900/30 border-red-500/30" :
                        maxDaysUnscheduled >= 3 ? "text-amber-400 bg-amber-900/40 border-amber-500/30" :
                        "text-yellow-500 bg-yellow-900/20 border-yellow-600/20"
                      }`}>
                        ⏰ {unscheduledCount} {unscheduledCount === 1 ? "post" : "posts"} sem agendar há {maxDaysUnscheduled} {maxDaysUnscheduled === 1 ? "dia" : "dias"}
                      </span>
                    )}
                    {waitingClient && (
                      <ChargeButton
                        campaignId={campaign.id}
                        lastChargedAt={(campaign as { lastChargedAt?: Date | null }).lastChargedAt?.toISOString() ?? null}
                        daysSinceOpen={Math.max(0, daysSinceOpen)}
                      />
                    )}

                    {!clientFinished && (
                      <>
                        {counts.approved > 0 && <span className="text-emerald-400">✅ {counts.approved}</span>}
                        {counts.adjustment > 0 && <span className="text-amber-400">✏️ {counts.adjustment}</span>}
                        {counts.rejected > 0 && <span className="text-red-400">❌ {counts.rejected}</span>}
                        {counts.pending > 0 && <span className="text-gray-400">⏳ {counts.pending}</span>}
                      </>
                    )}
                    {clientFinished && badgeType !== "approved" && (
                      <div className="flex items-center gap-2">
                        {counts.approved > 0 && <span className="text-emerald-400">✅ {counts.approved}</span>}
                        {counts.adjustment > 0 && <span className="text-amber-400">✏️ {counts.adjustment}</span>}
                        {counts.rejected > 0 && <span className="text-red-400">❌ {counts.rejected}</span>}
                      </div>
                    )}

                    {campaign.status === "INTERNAL_REVIEW" && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-violet-400 bg-violet-900/30 border border-violet-500/30 px-2.5 py-1 rounded-full">
                        🔍 Em revisão interna
                      </span>
                    )}
                    {campaign.status === "INTERNAL_DONE" && (
                      hasInternalAdjustmentRow ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-900/30 border border-amber-500/30 px-2.5 py-1 rounded-full animate-pulse">
                          ⚠️ Ajuste interno
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                          ✅ Pronto para cliente
                        </span>
                      )
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      campaign.status === "PUBLISHED" ? "bg-teal-900/30 text-teal-400"
                      : campaign.status === "CLOSED" ? "bg-gray-800 text-gray-400"
                      : campaign.status === "DRAFT" ? "bg-gray-800 text-gray-400"
                      : campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE" ? "bg-violet-900/30 text-violet-400"
                      : "bg-emerald-900/30 text-emerald-400"
                    }`}>
                      {campaign.status === "PUBLISHED" ? "Publicado"
                      : campaign.status === "CLOSED" ? "Fechado"
                      : campaign.status === "DRAFT" ? "Rascunho"
                      : campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE" ? "Revisão Interna"
                      : "Aberto"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Clients quick access */}
      {clients.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Clientes</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.05] transition-colors"
              >
                <p className="text-white text-sm font-medium truncate">{client.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {client.campaigns.length} {client.campaigns.length === 1 ? "campanha" : "campanhas"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
