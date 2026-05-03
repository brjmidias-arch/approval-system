"use client";

import { useState, useMemo } from "react";
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

const BUCKET_KEYS = ["overdue", "thisWeek", "nextWeek", "later"] as const;
type BucketKey = (typeof BUCKET_KEYS)[number];

const PROG_COLUMNS: { id: BucketKey; label: string; color: string; dot: string }[] = [
  { id: "overdue",  label: "Atrasados",     color: "text-red-400",   dot: "bg-red-500"   },
  { id: "thisWeek", label: "Esta semana",    color: "text-amber-400", dot: "bg-amber-500" },
  { id: "nextWeek", label: "Próx. semana",   color: "text-sky-400",   dot: "bg-sky-500"   },
  { id: "later",    label: "Mais tarde",     color: "text-gray-400",  dot: "bg-gray-500"  },
];

function getDateBucket(isoDate: string, nowIso: string): BucketKey {
  const d   = new Date(isoDate);
  const now = new Date(nowIso);
  const sd    = Date.UTC(d.getUTCFullYear(),   d.getUTCMonth(),   d.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (sd < today) return "overdue";
  const dow        = new Date(today).getUTCDay(); // 0=Sun
  const daysToMon  = dow === 0 ? -6 : 1 - dow;
  const weekStart  = today + daysToMon * 86_400_000;
  const weekEnd    = weekStart + 6  * 86_400_000;
  const nextWeekEnd = weekEnd  + 7  * 86_400_000;
  if (sd <= weekEnd)     return "thisWeek";
  if (sd <= nextWeekEnd) return "nextWeek";
  return "later";
}

function Thumbnail({ post }: { post: Post }) {
  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
      {post.fileType === "IMAGE" ? (
        <img src={post.fileUrl} alt="" className="w-full h-full object-cover" />
      ) : post.fileType === "VIDEO" ? (
        <span className="text-xl">🎬</span>
      ) : (
        <span className="text-xl">📄</span>
      )}
    </div>
  );
}

function PlannerCard({ post, daysWaiting }: { post: Post; daysWaiting: number }) {
  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-3">
        <Thumbnail post={post} />
        <div className="min-w-0 flex-1">
          {post.title && (
            <p className="text-white text-xs font-medium truncate mb-1">{post.title}</p>
          )}
          <span className="text-xs text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
            {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
          </span>
        </div>
      </div>
      {daysWaiting > 0 && (
        <div
          className={`text-xs px-2 py-0.5 rounded text-center ${
            daysWaiting >= 7
              ? "bg-red-900/30 text-red-400"
              : daysWaiting >= 3
              ? "bg-amber-900/30 text-amber-400"
              : "bg-yellow-900/20 text-yellow-500"
          }`}
        >
          {daysWaiting}d sem agendar
        </div>
      )}
    </div>
  );
}

function ScheduledCard({
  post,
  clientName,
  onMarkPosted,
}: {
  post: Post;
  clientName: string;
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

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Thumbnail post={post} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-violet-400 font-medium">{clientName}</p>
          {post.title && (
            <p className="text-white text-xs font-medium truncate">{post.title}</p>
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
      </div>
      {post.caption && (
        <div className="border-t border-white/5 px-3 py-2">
          <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-2">{post.caption}</p>
          <CopyButton text={post.caption} />
        </div>
      )}
      <div className="border-t border-white/5 px-3 py-2">
        <button
          onClick={handleMarkPosted}
          disabled={loading}
          className="w-full text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-lg transition-colors"
        >
          {loading ? "Salvando..." : "Marcar como Agendado"}
        </button>
      </div>
    </div>
  );
}

export default function ProgramacaoKanban({
  clients: initialClients,
  now,
}: {
  clients: ClientData[];
  now: string;
}) {
  const [scheduledDates, setScheduledDates] = useState<Record<string, string | null>>(() => {
    const dates: Record<string, string | null> = {};
    for (const c of initialClients)
      for (const p of c.posts) dates[p.id] = p.scheduledDate;
    return dates;
  });
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set());
  const [plannerClientId, setPlannerClientId] = useState<string | null>(null);

  function handleDateChange(postId: string, dateKey: string | null) {
    if (!dateKey) {
      setScheduledDates((prev) => ({ ...prev, [postId]: null }));
    } else {
      const [y, m, d] = dateKey.split("-").map(Number);
      const iso = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
      setScheduledDates((prev) => ({ ...prev, [postId]: iso }));
    }
  }

  function handleMarkPosted(postId: string) {
    setPostedIds((prev) => new Set(prev).add(postId));
  }

  // Planner columns — one per client with unscheduled (no date, not posted) posts
  const plannerColumns = useMemo(() => {
    const nowDate = new Date(now);
    return initialClients
      .map((client) => {
        const unscheduled = client.posts.filter(
          (p) => !scheduledDates[p.id] && !postedIds.has(p.id) && !p.postedAt
        );
        return {
          ...client,
          unscheduledPosts: unscheduled.map((p) => ({
            ...p,
            daysWaiting: p.approvedAt
              ? Math.floor(
                  (nowDate.getTime() - new Date(p.approvedAt).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 0,
          })),
        };
      })
      .filter((c) => c.unscheduledPosts.length > 0)
      .sort(
        (a, b) =>
          Math.max(0, ...b.unscheduledPosts.map((p) => p.daysWaiting)) -
          Math.max(0, ...a.unscheduledPosts.map((p) => p.daysWaiting))
      );
  }, [initialClients, scheduledDates, postedIds, now]);

  // Programação buckets — posts with a date, not yet posted
  const scheduledBuckets = useMemo(() => {
    const buckets: Record<BucketKey, Array<Post & { clientId: string; clientName: string }>> = {
      overdue: [], thisWeek: [], nextWeek: [], later: [],
    };
    for (const client of initialClients) {
      for (const post of client.posts) {
        const date = scheduledDates[post.id];
        if (!date || postedIds.has(post.id) || post.postedAt) continue;
        buckets[getDateBucket(date, now)].push({
          ...post,
          clientId: client.clientId,
          clientName: client.clientName,
        });
      }
    }
    for (const key of BUCKET_KEYS) {
      buckets[key].sort(
        (a, b) =>
          new Date(scheduledDates[a.id]!).getTime() -
          new Date(scheduledDates[b.id]!).getTime()
      );
    }
    return buckets;
  }, [initialClients, scheduledDates, postedIds, now]);

  const hasAnyScheduled = BUCKET_KEYS.some((k) => scheduledBuckets[k].length > 0);

  const plannerClient = initialClients.find((c) => c.clientId === plannerClientId);
  const plannerModalPosts = plannerClient
    ? plannerClient.posts
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
          clientName: plannerClient.clientName,
          campaignName: p.campaignName,
          campaignId: p.campaignId,
        }))
    : [];

  return (
    <>
      {/* Planner modal */}
      {plannerClient && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 bg-[#111] border-b border-white/10 shrink-0">
            <div>
              <h2 className="text-white font-semibold">
                Planner — {plannerClient.clientName}
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Arraste os posts para definir as datas de publicação
              </p>
            </div>
            <button
              onClick={() => setPlannerClientId(null)}
              className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <PlannerCalendar
              initialPosts={plannerModalPosts}
              clientId={plannerClient.clientId}
              onDateChange={handleDateChange}
            />
          </div>
        </div>
      )}

      <div className="space-y-10">
        {/* ── Kanban 1: Preencher Planner ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-white font-semibold">Preencher Planner</h2>
            {plannerColumns.length > 0 && (
              <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {plannerColumns.reduce((s, c) => s + c.unscheduledPosts.length, 0)} sem data
              </span>
            )}
          </div>

          {plannerColumns.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-gray-400 text-sm">
                Todos os posts já têm data no planner!
              </p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3">
              {plannerColumns.map((client) => (
                <div
                  key={client.clientId}
                  className="w-72 shrink-0 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                    <div>
                      <p className="text-white font-medium text-sm">
                        {client.clientName}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {client.unscheduledPosts.length} sem data
                      </p>
                    </div>
                    <button
                      onClick={() => setPlannerClientId(client.clientId)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-900/30 hover:bg-violet-900/50 text-violet-400 border border-violet-500/30 transition-colors shrink-0"
                    >
                      📅 Planner
                    </button>
                  </div>
                  <div className="p-3 space-y-2 overflow-y-auto max-h-[420px]">
                    {client.unscheduledPosts.map((post) => (
                      <PlannerCard
                        key={post.id}
                        post={post}
                        daysWaiting={post.daysWaiting}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Kanban 2: Programação ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-white font-semibold">Programação</h2>
            {hasAnyScheduled && (
              <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {BUCKET_KEYS.reduce((s, k) => s + scheduledBuckets[k].length, 0)} agendados
              </span>
            )}
          </div>

          {!hasAnyScheduled ? (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 text-center">
              <p className="text-2xl mb-2">📅</p>
              <p className="text-gray-400 text-sm">
                Nenhum post agendado ainda. Preencha o planner acima.
              </p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3">
              {PROG_COLUMNS.map((col) => {
                const posts = scheduledBuckets[col.id];
                if (posts.length === 0) {
                  return (
                    <div
                      key={col.id}
                      title={col.label}
                      className="w-9 shrink-0 bg-[#1a1a1a] border border-white/5 rounded-xl flex items-center justify-center py-4"
                    >
                      <span
                        className={`text-xs font-medium select-none ${col.color}`}
                        style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                      >
                        {col.label}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={col.id}
                    className="w-72 shrink-0 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <p className={`text-sm font-medium ${col.color}`}>{col.label}</p>
                      <span className="text-xs text-gray-500 ml-auto">{posts.length}</span>
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto max-h-[480px]">
                      {posts.map((post) => (
                        <ScheduledCard
                          key={post.id}
                          post={post}
                          clientName={post.clientName}
                          onMarkPosted={handleMarkPosted}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
