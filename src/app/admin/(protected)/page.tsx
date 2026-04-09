export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

function getStatusCounts(campaign: {
  approvalItems: { status: string }[];
  contentItems: { id: string }[];
}) {
  const total = campaign.contentItems.length;
  const approved = campaign.approvalItems.filter((a) => a.status === "APPROVED").length;
  const adjustment = campaign.approvalItems.filter((a) => a.status === "ADJUSTMENT").length;
  const rejected = campaign.approvalItems.filter((a) => a.status === "REJECTED").length;
  const pending = total - approved - adjustment - rejected;
  return { total, approved, adjustment, rejected, pending };
}

export default async function AdminDashboard() {
  const clients = await prisma.client.findMany({
    include: {
      campaigns: {
        include: {
          approvalItems: true,
          contentItems: true,
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
      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {/* Clients list */}
      <div className="space-y-4">
        {clients.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-gray-400">Nenhum cliente cadastrado ainda.</p>
            <Link
              href="/admin/clients"
              className="inline-block mt-3 text-emerald-400 hover:text-emerald-300 text-sm"
            >
              Cadastrar primeiro cliente →
            </Link>
          </div>
        ) : (
          clients.map((client) => (
            <div
              key={client.id}
              className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden"
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
                <div>
                  <h2 className="text-white font-medium">{client.name}</h2>
                  <p className="text-gray-400 text-sm">{client.email}</p>
                </div>
                <Link
                  href={`/admin/clients/${client.id}`}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Ver cliente →
                </Link>
              </div>

              {client.campaigns.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-500">Nenhuma campanha.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {client.campaigns.slice(0, 3).map((campaign) => {
                    const counts = getStatusCounts(campaign);
                    const isExpired =
                      new Date() > new Date(campaign.expiresAt) && campaign.status === "OPEN";

                    return (
                      <div key={campaign.id} className="px-5 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/admin/campaigns/${campaign.id}`}
                            className="text-white text-sm hover:text-emerald-400 transition-colors truncate block"
                          >
                            {campaign.name}
                          </Link>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {counts.total} itens · expira{" "}
                            {new Date(campaign.expiresAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-xs shrink-0">
                          {counts.approved > 0 && (
                            <span className="text-emerald-400">✅ {counts.approved}</span>
                          )}
                          {counts.adjustment > 0 && (
                            <span className="text-amber-400">✏️ {counts.adjustment}</span>
                          )}
                          {counts.rejected > 0 && (
                            <span className="text-red-400">❌ {counts.rejected}</span>
                          )}
                          {counts.pending > 0 && (
                            <span className="text-gray-400">⏳ {counts.pending}</span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              campaign.status === "CLOSED"
                                ? "bg-gray-800 text-gray-400"
                                : isExpired
                                ? "bg-red-900/30 text-red-400"
                                : "bg-emerald-900/30 text-emerald-400"
                            }`}
                          >
                            {campaign.status === "CLOSED"
                              ? "Fechado"
                              : isExpired
                              ? "Expirado"
                              : "Aberto"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {client.campaigns.length > 3 && (
                    <div className="px-5 py-2.5">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                      >
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
