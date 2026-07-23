"use client";

import { useState } from "react";
import Link from "next/link";

interface Post {
  id: string;
  fileUrl: string;
  fileType: string;
  title: string | null;
  caption: string | null;
  contentType: string;
  groupId: string | null;
  status: string;
  sentToProgramacaoAt: string | null;
  driveUrl: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
  TEXTO: "Texto",
};

function matchesStage(p: Post, stage: string): boolean {
  switch (stage) {
    case "internal": return p.status === "INTERNAL_REVIEW";
    case "internalDone": return p.status === "INTERNAL_DONE";
    case "clientReview": return p.status === "CLIENT_REVIEW";
    case "readyToSchedule": return p.status === "APPROVED" && !p.sentToProgramacaoAt;
    case "inProgramming": return p.status === "APPROVED" && !!p.sentToProgramacaoAt;
    case "draft": return p.status === "DRAFT";
    default: return false;
  }
}

/** Carousel slides (same groupId) collapse to one post (first = representative). */
function groupPosts(posts: Post[]): Post[] {
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const p of posts) {
    const key = p.contentType === "CARROSSEL" && p.groupId ? p.groupId : p.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export default function DashboardClientRow({
  clientId,
  clientName,
  count,
  stageId,
  stageColor,
}: {
  clientId: string;
  clientName: string;
  count: number;
  stageId: string;
  stageColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && posts === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/clients/${clientId}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const filtered = (data.contentItems ?? []).filter((p: Post) => matchesStage(p, stageId));
        setPosts(groupPosts(filtered));
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-gray-500 text-lg leading-none transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
            ›
          </span>
          <p className="text-white text-sm font-medium truncate">{clientName}</p>
        </div>
        <span className={`text-xs font-semibold shrink-0 ml-3 ${stageColor}`}>
          {count} {count === 1 ? "post" : "posts"}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/5 bg-black/20 px-4 py-3">
          {loading ? (
            <p className="text-gray-500 text-xs">Carregando...</p>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-2">
              {posts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-2">
                  <div className="w-9 h-9 rounded-md overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                    {p.fileType === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fileUrl} alt="" className="w-full h-full object-cover" />
                    ) : p.fileType === "VIDEO" ? (
                      <span className="text-sm">🎬</span>
                    ) : (
                      <span className="text-sm">📄</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {p.title && <p className="text-white text-xs font-medium truncate">{p.title}</p>}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[p.contentType] ?? p.contentType}
                      </span>
                      {p.caption && <span className="text-[11px] text-gray-500 truncate">{p.caption}</span>}
                    </div>
                  </div>
                </div>
              ))}
              <Link
                href={`/admin/clients/${clientId}`}
                className="inline-block text-xs text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
              >
                Abrir workspace do cliente →
              </Link>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">Nenhum post nesta etapa.</p>
          )}
        </div>
      )}
    </div>
  );
}
