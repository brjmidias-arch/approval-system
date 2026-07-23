"use client";

import { useState } from "react";
import Link from "next/link";

interface DashPost {
  id: string;
  title: string | null;
  caption: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
}

const TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
  TEXTO: "Texto",
};

function postLabel(p: DashPost): string {
  if (p.title && p.title.trim()) return p.title;
  if (p.caption && p.caption.trim()) {
    const s = p.caption.trim().replace(/\s+/g, " ");
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
  }
  return "(sem título)";
}

export default function DashboardClientRow({
  clientId,
  clientName,
  posts,
  stageColor,
}: {
  clientId: string;
  clientName: string;
  posts: DashPost[];
  stageColor: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-gray-500 text-lg leading-none transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
            ›
          </span>
          <p className="text-white text-sm font-medium truncate">{clientName}</p>
        </div>
        <span className={`text-xs font-semibold shrink-0 ml-3 ${stageColor}`}>
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/5 bg-black/20 px-3 py-2.5 space-y-1.5">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 bg-[#0f0f0f] border border-white/[0.06] rounded-lg px-2.5 py-1.5">
              <div className="w-8 h-8 rounded-md overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                {p.fileType === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.fileUrl} alt="" className="w-full h-full object-cover" />
                ) : p.fileType === "VIDEO" ? (
                  <span className="text-sm">🎬</span>
                ) : (
                  <span className="text-sm">📄</span>
                )}
              </div>
              <p className="text-white text-xs font-medium truncate flex-1 min-w-0">{postLabel(p)}</p>
              <span className="text-[10px] text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded shrink-0">
                {TYPE_LABELS[p.contentType] ?? p.contentType}
              </span>
            </div>
          ))}
          <Link
            href={`/admin/clients/${clientId}`}
            className="inline-block text-xs text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
          >
            Abrir workspace do cliente →
          </Link>
        </div>
      )}
    </div>
  );
}
