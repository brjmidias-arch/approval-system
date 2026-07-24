"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PostActionsMenu from "@/components/admin/PostActionsMenu";
import PostThumbnail from "@/components/admin/PostThumbnail";
import PostNameEditor from "@/components/admin/PostNameEditor";
import PostDatePicker from "@/components/admin/PostDatePicker";
import CopyProgLinkButton from "@/components/admin/CopyProgLinkButton";

export interface KanbanCardData {
  id: string;
  title: string | null;
  caption: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  clientId: string;
  clientName: string;
  driveUrl?: string | null;
  scheduledLabel?: string | null;
  scheduledInput?: string | null;
  daysWaiting?: number | null;
  adjustmentSource?: "cliente" | "interno" | null;
  adjustmentComment?: string | null;
}

function postLabel(p: { title: string | null; caption: string | null }): string {
  if (p.title && p.title.trim()) return p.title;
  if (p.caption && p.caption.trim()) {
    const s = p.caption.trim().replace(/\s+/g, " ");
    return s.length > 50 ? s.slice(0, 50) + "…" : s;
  }
  return "(sem título)";
}

export default function KanbanCard({
  post,
  stageId,
  draggable,
}: {
  post: KanbanCardData;
  stageId?: string;
  draggable?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function conclude(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-published" }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Erro ao concluir o post. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative"
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData("text/plain", post.id);
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
    >
      <Link
        href={`/admin/clients/${post.clientId}`}
        draggable={false}
        className={`block rounded-lg p-2 border transition-colors ${
          stageId === "scheduled"
            ? "bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400/60"
            : "bg-[#0f0f0f] border-white/[0.06] hover:border-white/20"
        } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${busy ? "opacity-50" : ""}`}
      >
        <div className="flex items-center gap-2 pr-6">
          <PostThumbnail fileType={post.fileType} fileUrl={post.fileUrl} driveUrl={post.driveUrl} label={postLabel(post)} />
          <div className="min-w-0 flex-1">
            <PostNameEditor postId={post.id} title={post.title} fallbackLabel={postLabel(post)} textClassName="text-white text-[11px] font-medium" />
            <p className="text-[10px] text-gray-500 truncate">{post.clientName}</p>
          </div>
        </div>
        {stageId === "readyToSchedule" && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PostDatePicker postId={post.id} value={post.scheduledInput ?? null} label={post.scheduledLabel ?? null} />
            <CopyProgLinkButton clientId={post.clientId} />
            {post.daysWaiting != null && post.daysWaiting > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-auto ${
                  post.daysWaiting >= 7
                    ? "bg-red-900/30 text-red-400"
                    : post.daysWaiting >= 3
                    ? "bg-amber-900/30 text-amber-400"
                    : "bg-yellow-900/20 text-yellow-500"
                }`}
              >
                {post.daysWaiting}d
              </span>
            )}
          </div>
        )}
        {stageId === "scheduled" && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PostDatePicker postId={post.id} value={post.scheduledInput ?? null} label={post.scheduledLabel ?? null} done />
            <CopyProgLinkButton clientId={post.clientId} />
            <button
              type="button"
              onClick={conclude}
              disabled={busy}
              className="text-[10px] px-2 py-0.5 rounded bg-teal-900/40 hover:bg-teal-900/60 text-teal-300 border border-teal-500/30 shrink-0 disabled:opacity-50 transition-colors ml-auto"
            >
              ✓ Concluído
            </button>
          </div>
        )}
        {post.adjustmentComment && (
          <p className="text-[10px] text-amber-400 mt-1 line-clamp-2">
            ✏️ {post.adjustmentSource === "cliente" ? "Cliente" : "Interno"}: {post.adjustmentComment}
          </p>
        )}
      </Link>

      {/* Menu de ações no canto do card */}
      <div className="absolute top-1 right-1 z-10">
        <PostActionsMenu postId={post.id} clientId={post.clientId} onBusyChange={setBusy} />
      </div>
    </div>
  );
}
