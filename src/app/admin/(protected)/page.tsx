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

type KanbanCol = "draft" | "internal" | "waiting" | "adjustments" | "planner" | "publish";

const COLUMNS: { id: KanbanCol; label: string; color: string; dot: string }[] = [
  { id: "draft",       label: "Rascunho",         color: "text-gray-400",    dot: "bg-gray-500"    },
  { id: "internal",    label: "Revisão Interna",   color: "text-violet-400",  dot: "bg-violet-500"  },
  { id: "waiting",     label: "Aguard. Cliente",   color: "text-emerald-400", dot: "bg-emerald-500" },
  { id: "adjustments", label: "Ajustes",           color: "text-amber-400",   dot: "bg-amber-500"   },
  { id: "planner",     label: "Preencher Planner", color: "text-sky-400",     dot: "bg-sky-500"     },
  { id: "publish",     label: "Publicar",          color: "text-teal-400",    dot: "bg-teal-500"    },
];

function unscheduledNonTextoCount(
  contentItems: { postedAt: Date | null; contentType: string; groupId: string | null; scheduledDate: Date | null }[]
) {
  const seen = new Set<string>();
  let count = 0;
  for (const item of contentItems) {
    if (item.postedAt) continue;
    if (item.contentType === "TEXTO") continue;
    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seen.has(item.groupId)) continue;
      seen.add(item.groupId);
    }
    if (!item.scheduledDate) count++;
  }
  return count;
}

function classifyCampaign(
  campaign: {
    status: string;
    contentItems: { postedAt: Date | null; contentType: string; groupId: string | null; scheduledDate: Date | null }[];
  },
  counts: { adjustment: number; rejected: number }
): KanbanCol {
  if (campaign.status === "DRAFT") return "draft";
  if (campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE") return "internal";
  if (campaign.status === "OPEN") return "waiting";
  if (campaign.status === "CLOSED") {
    if (counts.adjustment > 0 || counts.rejected > 0) return "adjustments";
    if (unscheduledNonTextoCount(campaign.contentItems) > 0) return "planner";
    return "publish";
  }
  return "draft";
}

export default async function AdminDashboard({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "concluidas" ? "concluidas" : "ativas";

  const clients = await prisma.client.findMany({
    include: {
      campaigns: {
        include: {
          approvalItems: true,
          contentItems: {
            select: {
              id: true,
              groupId: true,
              contentType: true,
              scheduledDate: true,
              postedAt: true,
              internalReviewItem: { select: { status: true } },
            },
          },
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
    (acc, c) =>
      acc + c.campaigns.filter((cam) => cam.status === "INTERNAL_REVIEW" || cam.status === "INTERNAL_DONE").length,
    0
  );
  const awaitingAction = clients.reduce(
    (acc, c) =>
      acc +
      c.campaigns.filter((cam) => {
        const counts = getStatusCounts(cam);
        return cam.status === "CLOSED" && counts.total > 0;
      }).length,
    0
  );

  const allCampaigns = clients.flatMap((client) =>
    client.campaigns.map((campaign) => ({ campaign, client }))
  );

  const activeCampaigns = allCampaigns.filter(({ campaign }) => campaign.status !== "PUBLISHED");
  const publishedCampaigns = allCampaigns
    .filter(({ campaign }) => campaign.status === "PUBLISHED")
    .sort((a, b) => new Date(b.campaign.createdAt).getTime() - new Date(a.campaign.createdAt).getTime());

  // Classify active campaigns into Kanban buckets
  type BucketEntry = {
    campaign: (typeof allCampaigns)[0]["campaign"];
    client: (typeof allCampaigns)[0]["client"];
    counts: ReturnType<typeof getStatusCounts>;
  };
  const buckets: Record<KanbanCol, BucketEntry[]> = {
    draft: [], internal: [], waiting: [], adjustments: [], planner: [], publish: [],
  };
  for (const { campaign, client } of activeCampaigns) {
    const counts = getStatusCounts(campaign);
    const col = classifyCampaign(campaign, counts);
    buckets[col].push({ campaign, client, counts });
  }

  // Notification bar data
  const internalAdjustItems = buckets.internal.filter(({ campaign }) =>
    campaign.contentItems.some(
      (i) => i.internalReviewItem?.status === "ADJUSTMENT" || i.internalReviewItem?.status === "REJECTED"
    )
  );
  const internalAdjustCount = internalAdjustItems.length;
  const adjustmentCount = buckets.adjustments.length;
  const longWaitItems = buckets.waiting.filter(({ campaign }) => {
    const days = Math.floor((Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 7;
  });
  const longWaitCount = longWaitItems.length;
  const plannerPostCount = buckets.planner.reduce(
    (sum, { campaign }) => sum + unscheduledNonTextoCount(campaign.contentItems),
    0
  );
  const hasAlerts = internalAdjustCount > 0 || adjustmentCount > 0 || longWaitCount > 0 || buckets.planner.length > 0;

  return (
    <div className="space-y-5">
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
        <div
          className={`border rounded-xl p-4 ${
            internalReviewCampaigns > 0 ? "bg-violet-900/20 border-violet-500/30" : "bg-[#1a1a1a] border-white/10"
          }`}
        >
          <p className="text-gray-400 text-xs uppercase tracking-wider">Revisão Interna</p>
          <p className={`text-3xl font-bold mt-1 ${internalReviewCampaigns > 0 ? "text-violet-400" : "text-white"}`}>
            {internalReviewCampaigns}
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Em Aberto</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{openCampaigns}</p>
        </div>
        <div
          className={`border rounded-xl p-4 ${
            awaitingAction > 0 ? "bg-amber-900/20 border-amber-500/30" : "bg-[#1a1a1a] border-white/10"
          }`}
        >
          <p className="text-gray-400 text-xs uppercase tracking-wider">Aguardando Ação</p>
          <p className={`text-3xl font-bold mt-1 ${awaitingAction > 0 ? "text-amber-400" : "text-white"}`}>
            {awaitingAction}
          </p>
        </div>
      </div>

      {/* Notification bar */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2 px-3 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl">
          {internalAdjustCount > 0 && (
            <Link
              href={internalAdjustCount === 1 ? `/admin/campaigns/${internalAdjustItems[0].campaign.id}` : "#kanban-col-internal"}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 bg-violet-900/40 border border-violet-500/40 px-3 py-1.5 rounded-full animate-pulse hover:bg-violet-900/60 transition-colors"
            >
              🔍 {internalAdjustCount} {internalAdjustCount === 1 ? "campanha" : "campanhas"} com ajuste interno
            </Link>
          )}
          {adjustmentCount > 0 && (
            <Link
              href={adjustmentCount === 1 ? `/admin/campaigns/${buckets.adjustments[0].campaign.id}` : "#kanban-col-adjustments"}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-900/40 border border-amber-500/40 px-3 py-1.5 rounded-full animate-pulse hover:bg-amber-900/60 transition-colors"
            >
              ⚠️ {adjustmentCount} {adjustmentCount === 1 ? "campanha aguarda" : "campanhas aguardam"} revisão do cliente
            </Link>
          )}
          {longWaitCount > 0 && (
            <Link
              href={longWaitCount === 1 ? `/admin/campaigns/${longWaitItems[0].campaign.id}` : "#kanban-col-waiting"}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-300 bg-orange-900/40 border border-orange-500/40 px-3 py-1.5 rounded-full hover:bg-orange-900/60 transition-colors"
            >
              ⏰ {longWaitCount} {longWaitCount === 1 ? "campanha aguarda" : "campanhas aguardam"} cliente há 7+ dias
            </Link>
          )}
          {buckets.planner.length > 0 && (
            <Link
              href="/admin/programacao"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 bg-sky-900/40 border border-sky-500/40 px-3 py-1.5 rounded-full hover:bg-sky-900/60 transition-colors"
            >
              📅 {plannerPostCount} {plannerPostCount === 1 ? "post" : "posts"} sem agendar — Ir para Programação →
            </Link>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <Link
          href="/admin"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "ativas" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Ativas{activeCampaigns.length > 0 && <span className="ml-1 text-xs opacity-60">{activeCampaigns.length}</span>}
        </Link>
        <Link
          href="/admin?tab=concluidas"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "concluidas" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Concluídas{publishedCampaigns.length > 0 && <span className="ml-1 text-xs opacity-60">{publishedCampaigns.length}</span>}
        </Link>
      </div>

      {tab === "ativas" ? (
        activeCampaigns.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-gray-400">Nenhuma campanha ativa.</p>
            <Link href="/admin/clients" className="inline-block mt-3 text-emerald-400 hover:text-emerald-300 text-sm">
              Cadastrar primeiro cliente →
            </Link>
          </div>
        ) : (
          /* Kanban board */
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {COLUMNS.map((col) => {
              const colItems = buckets[col.id];

              /* Collapsed empty column */
              if (colItems.length === 0) {
                return (
                  <div
                    key={col.id}
                    id={`kanban-col-${col.id}`}
                    className="flex-none w-9 border border-white/10 rounded-xl flex flex-col items-center justify-start py-3 gap-1.5 bg-[#1a1a1a]"
                    title={col.label}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot} opacity-40`} />
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider ${col.color} opacity-40 [writing-mode:vertical-lr] rotate-180`}
                    >
                      {col.label}
                    </span>
                  </div>
                );
              }

              return (
                <div key={col.id} id={`kanban-col-${col.id}`} className="flex-none w-[218px]">
                  {/* Column header */}
                  <div className="bg-[#1a1a1a] border border-white/10 rounded-t-xl px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${col.color}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-600 shrink-0 ml-1">{colItems.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="border border-t-0 border-white/10 rounded-b-xl overflow-hidden divide-y divide-white/5 min-h-[60px]">
                    {(
                      colItems.map(({ campaign, client, counts }) => {
                        const daysSince = Math.floor(
                          (Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const daysSinceOpen = Math.floor(
                          (Date.now() - new Date(campaign.expiresAt).getTime() + 24 * 60 * 60 * 1000) /
                            (1000 * 60 * 60 * 24)
                        );
                        const hasInternalAdj = campaign.contentItems.some(
                          (i) =>
                            i.internalReviewItem?.status === "ADJUSTMENT" ||
                            i.internalReviewItem?.status === "REJECTED"
                        );
                        const pendingInternalCount = campaign.contentItems.filter(
                          (i) => !i.internalReviewItem || i.internalReviewItem.status === "PENDING"
                        ).length;
                        const unscheduled =
                          col.id === "planner" ? unscheduledNonTextoCount(campaign.contentItems) : 0;
                        const hasTexto = campaign.contentItems.some((i) => i.contentType === "TEXTO");

                        return (
                          <Link
                            key={campaign.id}
                            href={`/admin/campaigns/${campaign.id}`}
                            className="block px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
                          >
                            <p className="text-white text-[12px] font-semibold truncate leading-tight">{client.name}</p>
                            <p className="text-gray-500 text-[11px] truncate leading-tight mt-0.5">{campaign.name}</p>

                            <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                              <span className="text-[10px] text-gray-600">
                                {counts.total} {counts.total === 1 ? "post" : "posts"}
                              </span>
                              {hasTexto && <span className="text-[10px] text-blue-400">· 📝</span>}

                              {col.id === "draft" && daysSince > 0 && (
                                <span className="text-[10px] text-gray-600">· {daysSince}d</span>
                              )}

                              {col.id === "internal" &&
                                (hasInternalAdj ? (
                                  <span className="text-[10px] font-medium text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">
                                    ⚠️ Ajuste
                                  </span>
                                ) : campaign.status === "INTERNAL_DONE" ? (
                                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">
                                    ✅ Pronto
                                  </span>
                                ) : pendingInternalCount > 0 ? (
                                  <span className="text-[10px] font-medium text-violet-400 bg-violet-900/30 px-1.5 py-0.5 rounded">
                                    🔍 {pendingInternalCount} pend.
                                  </span>
                                ) : null)}

                              {col.id === "waiting" && (
                                <span
                                  className={`text-[10px] font-medium ${
                                    daysSince >= 7
                                      ? "text-red-400"
                                      : daysSince >= 3
                                      ? "text-amber-400"
                                      : "text-gray-500"
                                  }`}
                                >
                                  · {daysSince === 0 ? "hoje" : `${daysSince}d`}
                                </span>
                              )}

                              {col.id === "adjustments" && (
                                <>
                                  {counts.adjustment > 0 && (
                                    <span className="text-[10px] text-amber-400">✏️ {counts.adjustment}</span>
                                  )}
                                  {counts.rejected > 0 && (
                                    <span className="text-[10px] text-red-400">❌ {counts.rejected}</span>
                                  )}
                                </>
                              )}

                              {col.id === "planner" && (
                                <span className="text-[10px] font-medium text-sky-400 bg-sky-900/30 px-1.5 py-0.5 rounded">
                                  📅 {unscheduled} p/ agendar
                                </span>
                              )}

                              {col.id === "publish" && (
                                <span className="text-[10px] font-medium text-teal-400 bg-teal-900/30 px-1.5 py-0.5 rounded">
                                  ✅ Todos aprovados
                                </span>
                              )}
                            </div>

                            {col.id === "waiting" && (
                              <div className="mt-1.5">
                                <ChargeButton
                                  campaignId={campaign.id}
                                  lastChargedAt={
                                    (campaign as { lastChargedAt?: Date | null }).lastChargedAt?.toISOString() ?? null
                                  }
                                  daysSinceOpen={Math.max(0, daysSinceOpen)}
                                />
                              </div>
                            )}
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Concluídas — flat list */
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
          {publishedCampaigns.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">Nenhuma campanha concluída ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {publishedCampaigns.map(({ campaign, client }) => {
                const counts = getStatusCounts(campaign);
                return (
                  <Link
                    key={campaign.id}
                    href={`/admin/campaigns/${campaign.id}`}
                    className="pl-4 pr-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors border-l-2 border-l-teal-500"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{client.name}</p>
                      <p className="text-gray-400 text-xs mt-0.5 truncate">
                        {campaign.name} · {counts.total} {counts.total === 1 ? "post" : "posts"}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/30 text-teal-400 font-medium shrink-0">
                      Publicado
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

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
