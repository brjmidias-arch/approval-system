export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AutoRefresh from "@/components/admin/AutoRefresh";
import DashboardClientRow from "@/components/admin/DashboardClientRow";

type Item = {
  id: string;
  status: string;
  groupId: string | null;
  contentType: string;
  sentToProgramacaoAt: Date | null;
};

/** Counts distinct POSTS matching a predicate — carousel slides (same groupId) count as one post. */
function countDistinctPosts(items: Item[], predicate: (item: Item) => boolean): number {
  const seen = new Set<string>();
  let count = 0;
  for (const item of items) {
    if (!predicate(item)) continue;
    const key = item.contentType === "CARROSSEL" && item.groupId ? item.groupId : item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    count++;
  }
  return count;
}

type StageId = "internal" | "internalDone" | "clientReview" | "readyToSchedule" | "inProgramming" | "draft";

const STAGES: { id: StageId; label: string; icon: string; color: string; dot: string; bg: string }[] = [
  { id: "internal", label: "Revisão interna", icon: "🔍", color: "text-violet-400", dot: "bg-violet-500", bg: "bg-violet-900/20 border-violet-500/30" },
  { id: "internalDone", label: "Revisão interna concluída", icon: "✅", color: "text-violet-300", dot: "bg-violet-400", bg: "bg-violet-900/10 border-violet-500/20" },
  { id: "clientReview", label: "Aguardando cliente", icon: "👤", color: "text-emerald-400", dot: "bg-emerald-500", bg: "bg-emerald-900/20 border-emerald-500/30" },
  { id: "readyToSchedule", label: "Prontos p/ programar", icon: "📅", color: "text-sky-400", dot: "bg-sky-500", bg: "bg-sky-900/20 border-sky-500/30" },
  { id: "inProgramming", label: "Na programação", icon: "🗓️", color: "text-teal-400", dot: "bg-teal-500", bg: "bg-teal-900/20 border-teal-500/30" },
  { id: "draft", label: "Rascunho", icon: "📝", color: "text-gray-400", dot: "bg-gray-500", bg: "bg-[#1a1a1a] border-white/10" },
];

function computeStageCounts(items: Item[]): Record<StageId, number> {
  return {
    internal: countDistinctPosts(items, (i) => i.status === "INTERNAL_REVIEW"),
    internalDone: countDistinctPosts(items, (i) => i.status === "INTERNAL_DONE"),
    clientReview: countDistinctPosts(items, (i) => i.status === "CLIENT_REVIEW"),
    readyToSchedule: countDistinctPosts(items, (i) => i.status === "APPROVED" && !i.sentToProgramacaoAt),
    inProgramming: countDistinctPosts(items, (i) => i.status === "APPROVED" && !!i.sentToProgramacaoAt),
    draft: countDistinctPosts(items, (i) => i.status === "DRAFT"),
  };
}

export default async function AdminDashboard() {
  const clients = await prisma.client.findMany({
    where: { contentItems: { some: {} } },
    select: {
      id: true,
      name: true,
      contentItems: {
        select: {
          id: true,
          status: true,
          groupId: true,
          contentType: true,
          sentToProgramacaoAt: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const clientStages = clients.map((client) => ({
    client,
    counts: computeStageCounts(client.contentItems),
  }));

  const totals: Record<StageId, number> = {
    internal: 0,
    internalDone: 0,
    clientReview: 0,
    readyToSchedule: 0,
    inProgramming: 0,
    draft: 0,
  };
  for (const { counts } of clientStages) {
    for (const stage of STAGES) {
      totals[stage.id] += counts[stage.id];
    }
  }

  const grandTotal = STAGES.reduce((sum, stage) => sum + totals[stage.id], 0);

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={30000} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <Link
          href="/admin/clients"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Cliente
        </Link>
      </div>

      {grandTotal === 0 ? (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-gray-400">Nenhum post em andamento.</p>
          <Link href="/admin/clients" className="inline-block mt-3 text-emerald-400 hover:text-emerald-300 text-sm">
            Ver clientes →
          </Link>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STAGES.map((stage) => (
              <div
                key={stage.id}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                  totals[stage.id] > 0 ? stage.bg : "bg-[#1a1a1a] border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wider font-medium leading-tight">
                    {stage.label}
                  </p>
                  <span className="text-lg shrink-0">{stage.icon}</span>
                </div>
                <p className={`text-3xl font-bold ${totals[stage.id] > 0 ? stage.color : "text-white"}`}>
                  {totals[stage.id]}
                </p>
              </div>
            ))}
          </div>

          {/* Sections by stage */}
          <div className="space-y-5">
            {STAGES.filter((stage) => totals[stage.id] > 0).map((stage) => {
              const clientsInStage = clientStages
                .filter(({ counts }) => counts[stage.id] > 0)
                .sort((a, b) => b.counts[stage.id] - a.counts[stage.id]);

              return (
                <div key={stage.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <h2 className={`text-sm font-semibold ${stage.color}`}>{stage.label}</h2>
                    <span className="text-xs text-gray-600">{totals[stage.id]}</span>
                  </div>
                  <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                    {clientsInStage.map(({ client, counts }) => (
                      <DashboardClientRow
                        key={client.id}
                        clientId={client.id}
                        clientName={client.name}
                        count={counts[stage.id]}
                        stageId={stage.id}
                        stageColor={stage.color}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
