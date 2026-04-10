export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

  // Cliente finalizou a revisão: campanha fechada com pelo menos 1 item revisado
  // OU todos os posts foram revisados (nenhum pendente) com campanha aberta
  const clientFinished = campaign.status === "CLOSED" && total > 0;
  const allReviewed = total > 0 && pending === 0;

  return { total, approved, adjustment, rejected, pending, clientFinished, allReviewed };
}

export default async function AdminDashboard() {
  const clients = await prisma.client.findMany({
    include: {
      campaigns: {
        include: {
          approvalItems: true,
          contentItems: { select: { id: true, groupId: true, contentType: true } },
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

  // Campaigns awaiting action (client finished, admin hasn't closed yet)
  const awaitingAction = clients.reduce(
    (acc, c) =>
      acc +
      c.campaigns.filter((cam) => {
        const counts = getStatusCounts(cam);
        return cam.status === "CLOSED" && counts.total > 0;
      }).length,
    0
  );

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Clientes</p>
          <p className="text-3xl font-bold text-white mt-1">{totalClients}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Campanhas</p>
          <p className="text-3xl font-bold text-white mt-1">{totalCampaigns}</p>
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

      {/* Clients list */}
      <div className="space-y-4">
        {clients.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-gray-400">Nenhum cliente cadastrado ainda.</p>
            <Link href="/admin/clients" className="inline-block mt-3 text-emerald-400 hover:text-emerald-300 text-sm">
              Cadastrar primeiro cliente →
            </Link>
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
                <div>
                  <h2 className="text-white font-medium">{client.name}</h2>
                  {client.email && <p className="text-gray-400 text-sm">{client.email}</p>}
                </div>
                <Link href={`/admin/clients/${client.id}`} className="text-gray-400 hover:text-white text-sm transition-colors">
                  Ver cliente →
                </Link>
              </div>

              {client.campaigns.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-500">Nenhuma campanha.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {client.campaigns.slice(0, 3).map((campaign) => {
                    const counts = getStatusCounts(campaign);
                    const isExpired = new Date() > new Date(campaign.expiresAt) && campaign.status === "OPEN";

                    // Determine visual state
                    const hasAdjustment = counts.adjustment > 0 || counts.rejected > 0;
                    const isFullyApproved = counts.total > 0 && counts.approved === counts.total;
                    const clientFinished = campaign.status === "CLOSED" && counts.total > 0;
                    const waitingClient = campaign.status === "OPEN" && counts.pending > 0 && !isExpired;

                    let rowBg = "";
                    let alertBadge = null;

                    if (clientFinished && hasAdjustment) {
                      rowBg = "bg-amber-900/10";
                      alertBadge = (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-900/30 border border-amber-500/30 px-2.5 py-1 rounded-full animate-pulse">
                          ⚠️ Revisar ajustes
                        </span>
                      );
                    } else if (clientFinished && isFullyApproved) {
                      rowBg = "bg-emerald-900/10";
                      alertBadge = (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-900/30 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                          ✅ Tudo aprovado — publicar
                        </span>
                      );
                    } else if (clientFinished) {
                      rowBg = "bg-blue-900/10";
                      alertBadge = (
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 bg-blue-900/30 border border-blue-500/30 px-2.5 py-1 rounded-full">
                          📋 Cliente finalizou revisão
                        </span>
                      );
                    } else if (waitingClient) {
                      alertBadge = (
                        <span className="text-xs text-gray-500">
                          Aguardando cliente
                        </span>
                      );
                    }

                    return (
                      <Link
                        key={campaign.id}
                        href={`/admin/campaigns/${campaign.id}`}
                        className={`px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer block ${rowBg}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{campaign.name}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {counts.total} {counts.total === 1 ? "post" : "posts"} · expira{" "}
                            {new Date(campaign.expiresAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-xs shrink-0">
                          {alertBadge}
                          {!clientFinished && (
                            <>
                              {counts.approved > 0 && <span className="text-emerald-400">✅ {counts.approved}</span>}
                              {counts.adjustment > 0 && <span className="text-amber-400">✏️ {counts.adjustment}</span>}
                              {counts.rejected > 0 && <span className="text-red-400">❌ {counts.rejected}</span>}
                              {counts.pending > 0 && <span className="text-gray-400">⏳ {counts.pending}</span>}
                            </>
                          )}
                          {clientFinished && !alertBadge?.props?.children?.includes("publicar") && (
                            <div className="flex items-center gap-2 text-xs">
                              {counts.approved > 0 && <span className="text-emerald-400">✅ {counts.approved}</span>}
                              {counts.adjustment > 0 && <span className="text-amber-400">✏️ {counts.adjustment}</span>}
                              {counts.rejected > 0 && <span className="text-red-400">❌ {counts.rejected}</span>}
                            </div>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            campaign.status === "CLOSED" ? "bg-gray-800 text-gray-400"
                            : isExpired ? "bg-red-900/30 text-red-400"
                            : "bg-emerald-900/30 text-emerald-400"
                          }`}>
                            {campaign.status === "CLOSED" ? "Fechado" : isExpired ? "Expirado" : "Aberto"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                  {client.campaigns.length > 3 && (
                    <div className="px-5 py-2.5">
                      <Link href={`/admin/clients/${client.id}`} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                        +{client.campaigns.length - 3} campanhas mais →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
