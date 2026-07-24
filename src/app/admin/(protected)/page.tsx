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
  title: string | null;
  caption: string | null;
  fileType: string;
  fileUrl: string;
  approvalItem: { status: string; clientComment: string | null } | null;
  internalReviewItem: { status: string; comment: string | null } | null;
};

/** A post for display (carousel = its representative slide). */
type DashPost = {
  id: string;
  title: string | null;
  caption: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  adjustmentSource: "cliente" | "interno" | null;
  adjustmentComment: string | null;
};

type StageId = "adjustment" | "internal" | "internalDone" | "clientReview" | "readyToSchedule" | "inProgramming" | "draft";

/** Post precisa de ajuste — o cliente OU a revisão interna pediu mudança/reprovou. */
function needsAdjustment(i: Item): boolean {
  const a = i.approvalItem?.status;
  const r = i.internalReviewItem?.status;
  return a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED";
}

const STAGE_PREDICATES: Record<StageId, (i: Item) => boolean> = {
  adjustment: needsAdjustment,
  internal: (i) => i.status === "INTERNAL_REVIEW" && !needsAdjustment(i),
  internalDone: (i) => i.status === "INTERNAL_DONE",
  clientReview: (i) => i.status === "CLIENT_REVIEW" && !needsAdjustment(i),
  readyToSchedule: (i) => i.status === "APPROVED" && !i.sentToProgramacaoAt,
  inProgramming: (i) => i.status === "APPROVED" && !!i.sentToProgramacaoAt,
  draft: (i) => i.status === "DRAFT",
};

/** Distinct POSTS matching a predicate — carousel slides (same groupId) collapse to one post. */
function distinctPosts(items: Item[], predicate: (item: Item) => boolean): DashPost[] {
  const seen = new Set<string>();
  const out: DashPost[] = [];
  for (const item of items) {
    if (!predicate(item)) continue;
    const key = item.contentType === "CARROSSEL" && item.groupId ? item.groupId : item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    // Fonte + comentário do ajuste (quando houver): cliente tem precedência sobre interno.
    let adjustmentSource: "cliente" | "interno" | null = null;
    let adjustmentComment: string | null = null;
    const a = item.approvalItem?.status;
    const r = item.internalReviewItem?.status;
    if (a === "ADJUSTMENT" || a === "REJECTED") {
      adjustmentSource = "cliente";
      adjustmentComment = item.approvalItem?.clientComment ?? null;
    } else if (r === "ADJUSTMENT" || r === "REJECTED") {
      adjustmentSource = "interno";
      adjustmentComment = item.internalReviewItem?.comment ?? null;
    }
    out.push({
      id: item.id,
      title: item.title,
      caption: item.caption,
      contentType: item.contentType,
      fileType: item.fileType,
      fileUrl: item.fileUrl,
      adjustmentSource,
      adjustmentComment,
    });
  }
  return out;
}

const STAGES: { id: StageId; label: string; icon: string; color: string; dot: string; bg: string }[] = [
  { id: "adjustment", label: "Ajustes", icon: "✏️", color: "text-amber-400", dot: "bg-amber-500", bg: "bg-amber-900/20 border-amber-500/30" },
  { id: "internal", label: "Revisão interna", icon: "🔍", color: "text-violet-400", dot: "bg-violet-500", bg: "bg-violet-900/20 border-violet-500/30" },
  { id: "internalDone", label: "Revisão interna concluída", icon: "✅", color: "text-violet-300", dot: "bg-violet-400", bg: "bg-violet-900/10 border-violet-500/20" },
  { id: "clientReview", label: "Aguardando cliente", icon: "👤", color: "text-emerald-400", dot: "bg-emerald-500", bg: "bg-emerald-900/20 border-emerald-500/30" },
  { id: "readyToSchedule", label: "Prontos p/ programar", icon: "📅", color: "text-sky-400", dot: "bg-sky-500", bg: "bg-sky-900/20 border-sky-500/30" },
  { id: "inProgramming", label: "Na programação", icon: "🗓️", color: "text-teal-400", dot: "bg-teal-500", bg: "bg-teal-900/20 border-teal-500/30" },
  { id: "draft", label: "Rascunho", icon: "📝", color: "text-gray-400", dot: "bg-gray-500", bg: "bg-[#1a1a1a] border-white/10" },
];

function computeStagePosts(items: Item[]): Record<StageId, DashPost[]> {
  return {
    adjustment: distinctPosts(items, STAGE_PREDICATES.adjustment),
    internal: distinctPosts(items, STAGE_PREDICATES.internal),
    internalDone: distinctPosts(items, STAGE_PREDICATES.internalDone),
    clientReview: distinctPosts(items, STAGE_PREDICATES.clientReview),
    readyToSchedule: distinctPosts(items, STAGE_PREDICATES.readyToSchedule),
    inProgramming: distinctPosts(items, STAGE_PREDICATES.inProgramming),
    draft: distinctPosts(items, STAGE_PREDICATES.draft),
  };
}

function postLabel(p: { title: string | null; caption: string | null }): string {
  if (p.title && p.title.trim()) return p.title;
  if (p.caption && p.caption.trim()) {
    const s = p.caption.trim().replace(/\s+/g, " ");
    return s.length > 50 ? s.slice(0, 50) + "…" : s;
  }
  return "(sem título)";
}

export default async function AdminDashboard({ searchParams }: { searchParams: { view?: string } }) {
  const view = searchParams?.view === "kanban" ? "kanban" : "lista";
  const clients = await prisma.client.findMany({
    where: { contentItems: { some: {} } },
    select: {
      id: true,
      name: true,
      contentItems: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          status: true,
          groupId: true,
          contentType: true,
          sentToProgramacaoAt: true,
          title: true,
          caption: true,
          fileType: true,
          fileUrl: true,
          approvalItem: { select: { status: true, clientComment: true } },
          internalReviewItem: { select: { status: true, comment: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const clientStages = clients.map((client) => ({
    client,
    stagePosts: computeStagePosts(client.contentItems),
  }));

  const totals: Record<StageId, number> = {
    adjustment: 0,
    internal: 0,
    internalDone: 0,
    clientReview: 0,
    readyToSchedule: 0,
    inProgramming: 0,
    draft: 0,
  };
  for (const { stagePosts } of clientStages) {
    for (const stage of STAGES) {
      totals[stage.id] += stagePosts[stage.id].length;
    }
  }

  const grandTotal = STAGES.reduce((sum, stage) => sum + totals[stage.id], 0);

  // Dados achatados por etapa para a visão kanban (cada card sabe seu cliente).
  type KanbanCard = DashPost & { clientId: string; clientName: string };
  const kanban = {} as Record<StageId, KanbanCard[]>;
  for (const stage of STAGES) kanban[stage.id] = [];
  for (const { client, stagePosts } of clientStages) {
    for (const stage of STAGES) {
      for (const p of stagePosts[stage.id]) {
        kanban[stage.id].push({ ...p, clientId: client.id, clientName: client.name });
      }
    }
  }

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={30000} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          {/* Toggle Lista / Kanban */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <Link
              href="/admin?view=lista"
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === "lista" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
            >
              ☰ Lista
            </Link>
            <Link
              href="/admin?view=kanban"
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === "kanban" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
            >
              ▦ Kanban
            </Link>
          </div>
          <Link
            href="/admin/clients"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + Novo Cliente
          </Link>
        </div>
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

          {view === "kanban" ? (
            /* Kanban: colunas por etapa (scroll horizontal) */
            <div className="flex gap-3 overflow-x-auto pb-3">
              {STAGES.map((stage) => (
                <div key={stage.id} className="w-72 shrink-0 flex flex-col">
                  <div className={`flex items-center gap-2 px-2 py-2 rounded-t-lg border-b-2 ${stage.bg}`}>
                    <span className="text-sm">{stage.icon}</span>
                    <h2 className={`text-xs font-semibold ${stage.color}`}>{stage.label}</h2>
                    <span className="text-[11px] text-gray-500 ml-auto">{kanban[stage.id].length}</span>
                  </div>
                  <div className="bg-[#141414] border border-white/[0.06] rounded-b-lg p-1.5 space-y-1.5 min-h-[80px] flex-1">
                    {kanban[stage.id].length === 0 ? (
                      <p className="text-[11px] text-gray-600 text-center py-4">—</p>
                    ) : (
                      kanban[stage.id].map((p) => (
                        <Link
                          key={p.id}
                          href={`/admin/clients/${p.clientId}`}
                          className="block bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-2 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-md overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                              {p.fileType === "IMAGE" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.fileUrl} alt="" className="w-full h-full object-cover" />
                              ) : p.fileType === "VIDEO" ? (
                                <span className="text-xs">🎬</span>
                              ) : (
                                <span className="text-xs">📄</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-[11px] font-medium truncate">{postLabel(p)}</p>
                              <p className="text-[10px] text-gray-500 truncate">{p.clientName}</p>
                            </div>
                          </div>
                          {p.adjustmentComment && (
                            <p className="text-[10px] text-amber-400 mt-1 line-clamp-2">
                              ✏️ {p.adjustmentSource === "cliente" ? "Cliente" : "Interno"}: {p.adjustmentComment}
                            </p>
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
          /* Lista: seções por etapa */
          <div className="space-y-5">
            {STAGES.filter((stage) => totals[stage.id] > 0).map((stage) => {
              const clientsInStage = clientStages
                .filter(({ stagePosts }) => stagePosts[stage.id].length > 0)
                .sort((a, b) => b.stagePosts[stage.id].length - a.stagePosts[stage.id].length);

              return (
                <div key={stage.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <h2 className={`text-sm font-semibold ${stage.color}`}>{stage.label}</h2>
                    <span className="text-xs text-gray-600">{totals[stage.id]}</span>
                  </div>
                  <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                    {clientsInStage.map(({ client, stagePosts }) => (
                      <DashboardClientRow
                        key={client.id}
                        clientId={client.id}
                        clientName={client.name}
                        posts={stagePosts[stage.id]}
                        stageColor={stage.color}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </>
      )}
    </div>
  );
}
