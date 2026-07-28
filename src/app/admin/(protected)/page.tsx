export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AutoRefresh from "@/components/admin/AutoRefresh";
import DashboardClientRow from "@/components/admin/DashboardClientRow";
import KanbanBoard from "@/components/admin/KanbanBoard";
import DashboardUploadButton from "@/components/admin/DashboardUploadButton";

type Item = {
  id: string;
  status: string;
  groupId: string | null;
  contentType: string;
  sentToProgramacaoAt: Date | null;
  scheduledDate: Date | null;
  postedAt: Date | null;
  title: string | null;
  caption: string | null;
  fileType: string;
  fileUrl: string;
  driveUrl: string | null;
  coverDriveUrl: string | null;
  roteiroConteudoId: string | null;
  asanaUrl: string | null;
  approvalItem: { status: string; clientComment: string | null; reviewedAt: Date | null } | null;
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
  driveUrl: string | null;
  scheduledLabel: string | null;
  scheduledInput: string | null;
  daysWaiting: number | null;
  roteiroAttached: boolean;
  asanaUrl: string | null;
  adjustmentSource: "cliente" | "interno" | null;
  adjustmentComment: string | null;
};

type StageId = "adjustment" | "internal" | "clientReview" | "criarCapa" | "readyToSchedule" | "scheduled" | "published" | "draft";

/** Formata a data agendada como DD/MM (UTC, pois é gravada em T12:00:00Z). */
function fmtScheduled(d: Date | null): string | null {
  if (!d) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/** Data agendada no formato YYYY-MM-DD (valor de <input type="date">). */
function fmtScheduledInput(d: Date | null): string | null {
  if (!d) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Dias desde a aprovação do cliente (para o selo de urgência em "Prontos p/ programar"). */
function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Post precisa de ajuste — o cliente OU a revisão interna pediu mudança/reprovou. */
function needsAdjustment(i: Item): boolean {
  const a = i.approvalItem?.status;
  const r = i.internalReviewItem?.status;
  return a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED";
}

/** Vídeo (Reels/vídeo) aprovado que ainda não tem capa → precisa criar a capa (design). */
function needsCover(i: Item): boolean {
  const isVideo = i.contentType === "REELS" || i.fileType === "VIDEO";
  return isVideo && !i.coverDriveUrl;
}

const STAGE_PREDICATES: Record<StageId, (i: Item) => boolean> = {
  adjustment: needsAdjustment,
  // INTERNAL_DONE (legado do modelo por-campanha) cai aqui como fallback: no fluxo
  // por-post a aprovação interna já pula direto para CLIENT_REVIEW.
  internal: (i) => (i.status === "INTERNAL_REVIEW" || i.status === "INTERNAL_DONE") && !needsAdjustment(i),
  clientReview: (i) => i.status === "CLIENT_REVIEW" && !needsAdjustment(i),
  // Aprovado pelo cliente mas é vídeo SEM capa → vai para "Criar capa" (design).
  criarCapa: (i) => i.status === "APPROVED" && needsCover(i),
  // Aprovado pelo cliente (com capa, ou não-vídeo) → prontos p/ programar. Só vai para
  // "Posts programados" quando o social clica "Agendado" no link (status SCHEDULED).
  readyToSchedule: (i) => i.status === "APPROVED" && !needsCover(i),
  scheduled: (i) => i.status === "SCHEDULED",
  published: (i) => i.status === "PUBLISHED",
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
      driveUrl: item.driveUrl,
      scheduledLabel: fmtScheduled(item.scheduledDate),
      scheduledInput: fmtScheduledInput(item.scheduledDate),
      daysWaiting: daysSince(item.approvalItem?.reviewedAt ?? null),
      roteiroAttached: !!item.roteiroConteudoId,
      asanaUrl: item.asanaUrl,
      adjustmentSource,
      adjustmentComment,
    });
  }
  return out;
}

const STAGES: { id: StageId; label: string; icon: string; color: string; dot: string; bg: string }[] = [
  { id: "adjustment", label: "Ajustes", icon: "✏️", color: "text-amber-400", dot: "bg-amber-500", bg: "bg-amber-900/20 border-amber-500/30" },
  { id: "internal", label: "Revisão interna", icon: "🔍", color: "text-violet-400", dot: "bg-violet-500", bg: "bg-violet-900/20 border-violet-500/30" },
  { id: "clientReview", label: "Aguardando cliente", icon: "👤", color: "text-emerald-400", dot: "bg-emerald-500", bg: "bg-emerald-900/20 border-emerald-500/30" },
  { id: "criarCapa", label: "Criar capa", icon: "🎨", color: "text-pink-400", dot: "bg-pink-500", bg: "bg-pink-900/20 border-pink-500/30" },
  { id: "readyToSchedule", label: "Prontos p/ programar", icon: "📅", color: "text-sky-400", dot: "bg-sky-500", bg: "bg-sky-900/20 border-sky-500/30" },
  { id: "scheduled", label: "Posts programados", icon: "🗓️", color: "text-indigo-400", dot: "bg-indigo-500", bg: "bg-indigo-900/20 border-indigo-500/30" },
  { id: "published", label: "Concluído", icon: "✅", color: "text-teal-400", dot: "bg-teal-500", bg: "bg-teal-900/20 border-teal-500/30" },
  { id: "draft", label: "Rascunho", icon: "📝", color: "text-gray-400", dot: "bg-gray-500", bg: "bg-[#1a1a1a] border-white/10" },
];

const CONCLUIDO_TTL_MS = 10 * 24 * 60 * 60 * 1000; // 10 dias

function computeStagePosts(items: Item[]): Record<StageId, DashPost[]> {
  // Posts concluídos (PUBLISHED) há mais de 10 dias somem do dashboard.
  // Os dados permanecem no banco / workspace do cliente — nada é apagado.
  const cutoff = Date.now() - CONCLUIDO_TTL_MS;
  items = items.filter(
    (i) => !(i.status === "PUBLISHED" && i.postedAt != null && i.postedAt.getTime() < cutoff)
  );
  return {
    adjustment: distinctPosts(items, STAGE_PREDICATES.adjustment),
    internal: distinctPosts(items, STAGE_PREDICATES.internal),
    clientReview: distinctPosts(items, STAGE_PREDICATES.clientReview),
    criarCapa: distinctPosts(items, STAGE_PREDICATES.criarCapa),
    readyToSchedule: distinctPosts(items, STAGE_PREDICATES.readyToSchedule),
    scheduled: distinctPosts(items, STAGE_PREDICATES.scheduled),
    published: distinctPosts(items, STAGE_PREDICATES.published),
    draft: distinctPosts(items, STAGE_PREDICATES.draft),
  };
}

export default async function AdminDashboard({ searchParams }: { searchParams: { view?: string } }) {
  const view = searchParams?.view === "lista" ? "lista" : "kanban";
  // Não trazer do banco os concluídos antigos (PUBLISHED > 10 dias ou sem data de
  // publicação): eles somem do dashboard de qualquer forma. Reduz muito a carga.
  const concluidoCutoff = new Date(Date.now() - CONCLUIDO_TTL_MS);
  const clients = await prisma.client.findMany({
    where: { contentItems: { some: {} } },
    select: {
      id: true,
      name: true,
      token: true,
      contentItems: {
        where: {
          OR: [{ status: { not: "PUBLISHED" } }, { postedAt: { gte: concluidoCutoff } }],
        },
        orderBy: { order: "asc" },
        select: {
          id: true,
          status: true,
          groupId: true,
          contentType: true,
          sentToProgramacaoAt: true,
          scheduledDate: true,
          postedAt: true,
          title: true,
          caption: true,
          fileType: true,
          fileUrl: true,
          driveUrl: true,
          coverDriveUrl: true,
          roteiroConteudoId: true,
          asanaUrl: true,
          approvalItem: { select: { status: true, clientComment: true, reviewedAt: true } },
          internalReviewItem: { select: { status: true, comment: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Todos os clientes (inclusive sem posts) para o seletor do botão "Enviar roteiros".
  const allClients = await prisma.client.findMany({
    select: { id: true, name: true, _count: { select: { contentItems: true } } },
    orderBy: { name: "asc" },
  });
  const clientOptions = allClients.map((c) => ({ id: c.id, name: c.name, itemCount: c._count.contentItems }));

  const clientStages = clients.map((client) => ({
    client,
    stagePosts: computeStagePosts(client.contentItems),
  }));

  const totals: Record<StageId, number> = {
    adjustment: 0,
    internal: 0,
    clientReview: 0,
    criarCapa: 0,
    readyToSchedule: 0,
    scheduled: 0,
    published: 0,
    draft: 0,
  };
  for (const { stagePosts } of clientStages) {
    for (const stage of STAGES) {
      totals[stage.id] += stagePosts[stage.id].length;
    }
  }

  const grandTotal = STAGES.reduce((sum, stage) => sum + totals[stage.id], 0);

  // Dados achatados por etapa para a visão kanban (cada card sabe seu cliente).
  type KanbanCard = DashPost & { clientId: string; clientName: string; clientToken: string | null };
  const kanban = {} as Record<StageId, KanbanCard[]>;
  for (const stage of STAGES) kanban[stage.id] = [];
  for (const { client, stagePosts } of clientStages) {
    for (const stage of STAGES) {
      for (const p of stagePosts[stage.id]) {
        kanban[stage.id].push({ ...p, clientId: client.id, clientName: client.name, clientToken: client.token });
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
            href="/admin/responsaveis"
            className="text-sm px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
            title="Responsáveis por fase (Roteirização)"
          >
            ⚙️ Responsáveis
          </Link>
          <DashboardUploadButton clients={clientOptions} />
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
            <KanbanBoard stages={STAGES} columns={kanban} />
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
                        clientToken={client.token}
                        posts={stagePosts[stage.id]}
                        stageColor={stage.color}
                        stageId={stage.id}
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
