"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PlannerCalendar from "./PlannerCalendar";
import CopyButton from "./CopyButton";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
};

export interface Post {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  coverUrl: string | null;
  coverDriveUrl: string | null;
  caption: string | null;
  driveUrl: string | null;
  groupId: string | null;
  scheduledDate: string | null;
  postedAt: string | null;
  approvedAt: string | null;
}

export interface ClientData {
  clientId: string;
  clientName: string;
  posts: Post[];
  maxDaysWaiting: number;
}

// ── small post thumbnail ──────────────────────────────────────────────────────
function Thumb({ post }: { post: Post }) {
  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
      {post.fileType === "IMAGE" ? (
        <img src={post.fileUrl} alt="" className="w-full h-full object-cover" />
      ) : post.fileType === "VIDEO" ? (
        <span className="text-lg">🎬</span>
      ) : (
        <span className="text-lg">📄</span>
      )}
    </div>
  );
}

// ── post row inside "Preencher Planner" ───────────────────────────────────────
function PlannerPostRow({ post, daysWaiting }: { post: Post; daysWaiting: number }) {
  const hasDriveLinks = post.driveUrl || (post.contentType === "REELS" && post.coverDriveUrl);

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <Thumb post={post} />
        <div className="min-w-0 flex-1 space-y-1">
          {post.title && (
            <p className="text-white text-xs font-medium">{post.title}</p>
          )}
          <span className="text-xs text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
            {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
          </span>
        </div>
        {daysWaiting > 0 && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
              daysWaiting >= 7
                ? "bg-red-900/30 text-red-400"
                : daysWaiting >= 3
                ? "bg-amber-900/30 text-amber-400"
                : "bg-yellow-900/20 text-yellow-500"
            }`}
          >
            {daysWaiting}d
          </span>
        )}
      </div>

      {/* Drive links */}
      {hasDriveLinks && (
        <div className="border-t border-white/5 px-3 py-2 flex flex-wrap gap-2">
          {post.driveUrl && (
            <a
              href={post.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              🔗 Arquivo no Drive
            </a>
          )}
          {post.contentType === "REELS" && post.coverDriveUrl && (
            <a
              href={post.coverDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-900/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              🖼️ Capa no Drive
            </a>
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="border-t border-white/5 px-3 py-3">
          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
          <div className="mt-2">
            <CopyButton text={post.caption} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── post row inside "Programação" ─────────────────────────────────────────────
function ProgPostRow({
  post,
  onMarkPosted,
}: {
  post: Post;
  onMarkPosted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleMarkPosted() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${post.campaignId}/items/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      onMarkPosted(post.id);
    } catch {
      alert("Erro ao marcar como agendado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const hasDriveLinks = post.driveUrl || (post.contentType === "REELS" && post.coverDriveUrl);

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header: thumb + type + date + action */}
      <div className="flex items-start gap-3 p-3">
        <Thumb post={post} />
        <div className="min-w-0 flex-1 space-y-1">
          {post.title && (
            <p className="text-white text-xs font-medium">{post.title}</p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
              {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
            </span>
            {post.scheduledDate && (
              <span className="text-xs text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                📅{" "}
                {new Date(post.scheduledDate).toLocaleDateString("pt-BR", {
                  timeZone: "UTC",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleMarkPosted}
          disabled={loading}
          className="shrink-0 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium px-2.5 py-1.5 rounded-lg transition-colors"
        >
          {loading ? "..." : "Agendado ✓"}
        </button>
      </div>

      {/* Drive links */}
      {hasDriveLinks && (
        <div className="border-t border-white/5 px-3 py-2 flex flex-wrap gap-2">
          {post.driveUrl && (
            <a
              href={post.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              🔗 Arquivo no Drive
            </a>
          )}
          {post.contentType === "REELS" && post.coverDriveUrl && (
            <a
              href={post.coverDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-900/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              🖼️ Capa no Drive
            </a>
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="border-t border-white/5 px-3 py-3">
          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
          <div className="mt-2">
            <CopyButton text={post.caption} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── collapsible client card ───────────────────────────────────────────────────
function ClientCard({
  clientName,
  subtitle,
  urgency,
  isOpen,
  onToggle,
  plannerButton,
  children,
}: {
  clientName: string;
  subtitle: string;
  urgency?: "red" | "amber" | "yellow" | null;
  isOpen: boolean;
  onToggle: () => void;
  plannerButton?: React.ReactNode;
  children: React.ReactNode;
}) {
  const borderColor =
    urgency === "red"
      ? "border-l-red-500"
      : urgency === "amber"
      ? "border-l-amber-500"
      : urgency === "yellow"
      ? "border-l-yellow-600"
      : "border-l-white/10";

  return (
    <div className={`bg-[#1a1a1a] border border-white/10 border-l-2 ${borderColor} rounded-xl overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="min-w-0">
          <p className="text-white font-medium text-sm">{clientName}</p>
          <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {plannerButton}
          <span
            className={`text-gray-400 text-lg transition-transform duration-200 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-white/5 p-3 space-y-2">{children}</div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function ProgramacaoKanban({
  clients: initialClients,
  now,
}: {
  clients: ClientData[];
  now: string;
}) {
  const router = useRouter();
  const [scheduledDates, setScheduledDates] = useState<Record<string, string | null>>(() => {
    const dates: Record<string, string | null> = {};
    for (const c of initialClients)
      for (const p of c.posts) dates[p.id] = p.scheduledDate;
    return dates;
  });
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set());
  const [openPlanner, setOpenPlanner] = useState<string | null>(null);
  const [openProg, setOpenProg] = useState<string | null>(null);
  const [plannerModalClientId, setPlannerModalClientId] = useState<string | null>(null);

  function handleDateChange(postId: string, dateKey: string | null) {
    if (!dateKey) {
      setScheduledDates((prev) => ({ ...prev, [postId]: null }));
    } else {
      const [y, m, d] = dateKey.split("-").map(Number);
      setScheduledDates((prev) => ({
        ...prev,
        [postId]: new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString(),
      }));
    }
  }

  function handleMarkPosted(postId: string) {
    setPostedIds((prev) => new Set(prev).add(postId));
    router.refresh();
  }

  const nowDate = new Date(now);

  // Column 1 — clients with unscheduled posts
  const plannerClients = useMemo(
    () =>
      initialClients
        .map((c) => {
          const unscheduled = c.posts.filter(
            (p) => !scheduledDates[p.id] && !postedIds.has(p.id) && !p.postedAt
          );
          const maxDays = unscheduled.reduce((max, p) => {
            if (!p.approvedAt) return max;
            return Math.max(
              max,
              Math.floor(
                (nowDate.getTime() - new Date(p.approvedAt).getTime()) / (1000 * 60 * 60 * 24)
              )
            );
          }, 0);
          return { ...c, unscheduled, maxDays };
        })
        .filter((c) => c.unscheduled.length > 0)
        .sort((a, b) => b.maxDays - a.maxDays),
    [initialClients, scheduledDates, postedIds, nowDate]
  );

  // Column 2 — clients with scheduled (not yet posted) posts
  const progClients = useMemo(
    () =>
      initialClients
        .map((c) => {
          const scheduled = c.posts
            .filter((p) => scheduledDates[p.id] && !postedIds.has(p.id) && !p.postedAt)
            .sort(
              (a, b) =>
                new Date(scheduledDates[a.id]!).getTime() -
                new Date(scheduledDates[b.id]!).getTime()
            );
          return { ...c, scheduled };
        })
        .filter((c) => c.scheduled.length > 0),
    [initialClients, scheduledDates, postedIds]
  );

  // Planner modal data
  const plannerModalClient = initialClients.find((c) => c.clientId === plannerModalClientId);
  const plannerModalPosts = plannerModalClient
    ? plannerModalClient.posts
        .filter((p) => !postedIds.has(p.id) && !p.postedAt)
        .map((p) => ({
          id: p.id,
          title: p.title,
          contentType: p.contentType,
          fileUrl: p.fileUrl,
          fileType: p.fileType,
          coverUrl: p.coverUrl,
          caption: p.caption,
          scheduledDate: scheduledDates[p.id] ?? null,
          clientName: plannerModalClient.clientName,
          campaignName: p.campaignName,
          campaignId: p.campaignId,
        }))
    : [];

  return (
    <>
      {/* Planner modal */}
      {plannerModalClient && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 bg-[#111] border-b border-white/10 shrink-0">
            <div>
              <h2 className="text-white font-semibold">
                Planner — {plannerModalClient.clientName}
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Arraste os posts para definir as datas de publicação
              </p>
            </div>
            <button
              onClick={() => setPlannerModalClientId(null)}
              className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <PlannerCalendar
              initialPosts={plannerModalPosts}
              clientId={plannerModalClient.clientId}
              onDateChange={handleDateChange}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* ── Coluna 1: Preencher Planner ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-white font-semibold text-sm">Preencher Planner</h2>
            {plannerClients.length > 0 && (
              <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {plannerClients.reduce((s, c) => s + c.unscheduled.length, 0)} posts
              </span>
            )}
          </div>

          {plannerClients.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-gray-400 text-sm">Todos com data!</p>
            </div>
          ) : (
            plannerClients.map((client) => {
              const urgency =
                client.maxDays >= 7
                  ? ("red" as const)
                  : client.maxDays >= 3
                  ? ("amber" as const)
                  : client.maxDays >= 1
                  ? ("yellow" as const)
                  : null;

              const subtitle =
                client.unscheduled.length === 1
                  ? "1 post sem data"
                  : `${client.unscheduled.length} posts sem data`;

              return (
                <ClientCard
                  key={client.clientId}
                  clientName={client.clientName}
                  subtitle={
                    client.maxDays > 0
                      ? `${subtitle} · há ${client.maxDays} ${client.maxDays === 1 ? "dia" : "dias"}`
                      : subtitle
                  }
                  urgency={urgency}
                  isOpen={openPlanner === client.clientId}
                  onToggle={() =>
                    setOpenPlanner(
                      openPlanner === client.clientId ? null : client.clientId
                    )
                  }
                  plannerButton={
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlannerModalClientId(client.clientId);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-violet-900/30 hover:bg-violet-900/50 text-violet-400 border border-violet-500/30 transition-colors"
                    >
                      📅 Planner
                    </button>
                  }
                >
                  {client.unscheduled.map((post) => {
                    const daysWaiting = post.approvedAt
                      ? Math.floor(
                          (nowDate.getTime() - new Date(post.approvedAt).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : 0;
                    return (
                      <PlannerPostRow
                        key={post.id}
                        post={post}
                        daysWaiting={daysWaiting}
                      />
                    );
                  })}
                </ClientCard>
              );
            })
          )}
        </div>

        {/* ── Coluna 2: Programação ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-white font-semibold text-sm">Programação</h2>
            {progClients.length > 0 && (
              <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {progClients.reduce((s, c) => s + c.scheduled.length, 0)} posts
              </span>
            )}
          </div>

          {progClients.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 text-center">
              <p className="text-2xl mb-2">📅</p>
              <p className="text-gray-400 text-sm">Nenhum post agendado ainda.</p>
            </div>
          ) : (
            progClients.map((client) => {
              const count = client.scheduled.length;
              const earliest = client.scheduled[0]?.scheduledDate
                ? new Date(scheduledDates[client.scheduled[0].id]!).toLocaleDateString(
                    "pt-BR",
                    { timeZone: "UTC", day: "2-digit", month: "2-digit" }
                  )
                : null;

              return (
                <ClientCard
                  key={client.clientId}
                  clientName={client.clientName}
                  subtitle={
                    earliest
                      ? `${count} ${count === 1 ? "post" : "posts"} · próximo em ${earliest}`
                      : `${count} ${count === 1 ? "post agendado" : "posts agendados"}`
                  }
                  isOpen={openProg === client.clientId}
                  onToggle={() =>
                    setOpenProg(openProg === client.clientId ? null : client.clientId)
                  }
                >
                  {client.scheduled.map((post) => (
                    <ProgPostRow
                      key={post.id}
                      post={post}
                      onMarkPosted={handleMarkPosted}
                    />
                  ))}
                </ClientCard>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
