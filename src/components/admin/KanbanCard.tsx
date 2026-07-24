"use client";

import { useState } from "react";
import Link from "next/link";
import PostActionsMenu from "@/components/admin/PostActionsMenu";
import PostThumbnail from "@/components/admin/PostThumbnail";
import PostNameEditor from "@/components/admin/PostNameEditor";

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

export default function KanbanCard({ post }: { post: KanbanCardData }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative">
      <Link
        href={`/admin/clients/${post.clientId}`}
        className={`block bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-2 hover:border-white/20 transition-colors ${busy ? "opacity-50" : ""}`}
      >
        <div className="flex items-center gap-2 pr-6">
          <PostThumbnail fileType={post.fileType} fileUrl={post.fileUrl} driveUrl={post.driveUrl} label={postLabel(post)} />
          <div className="min-w-0 flex-1">
            <PostNameEditor postId={post.id} title={post.title} fallbackLabel={postLabel(post)} textClassName="text-white text-[11px] font-medium" />
            <p className="text-[10px] text-gray-500 truncate">{post.clientName}</p>
          </div>
        </div>
        {post.scheduledLabel && (
          <p className="text-[10px] text-sky-400 mt-1">📅 Programado para {post.scheduledLabel}</p>
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
