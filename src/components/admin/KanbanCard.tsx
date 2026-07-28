"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PostActionsMenu from "@/components/admin/PostActionsMenu";
import PostThumbnail from "@/components/admin/PostThumbnail";
import { buildAprovacaoMsg } from "@/lib/aprovacaoMsg";
import { driveAssetsFromLink } from "@/lib/drive";
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
  clientToken?: string | null;
  driveUrl?: string | null;
  scheduledLabel?: string | null;
  scheduledInput?: string | null;
  daysWaiting?: number | null;
  roteiroAttached?: boolean;
  asanaUrl?: string | null;
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
  const [showDrive, setShowDrive] = useState(false);
  const [driveLink, setDriveLink] = useState("");

  const internalMsg = buildAprovacaoMsg({
    title: post.title,
    clientName: post.clientName,
    asanaUrl: post.asanaUrl,
    connected: !!post.roteiroAttached,
    driveUrl: post.driveUrl,
    adjustment: post.adjustmentComment,
  });

  async function patchPost(body: Record<string, unknown>, errMsg: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      return true;
    } catch {
      alert(errMsg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function conclude(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await patchPost({ action: "mark-published" }, "Erro ao concluir o post. Tente novamente.");
  }

  function ajusteFeito(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(internalMsg);
    patchPost({ action: "adjustment-done" }, "Erro ao reenviar. Tente novamente.");
  }

  async function saveDriveLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const assets = driveAssetsFromLink(driveLink.trim(), post.fileType);
    if (!assets) {
      alert("Link do Drive inválido. Cole um link de arquivo ou pasta do Google Drive.");
      return;
    }
    const ok = await patchPost(assets, "Erro ao salvar o link. Tente novamente.");
    if (ok) { setShowDrive(false); setDriveLink(""); }
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
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-gray-500 truncate min-w-0">{post.clientName}</p>
              {post.roteiroAttached && (
                <span className="text-[9px] text-fuchsia-300 bg-fuchsia-900/30 border border-fuchsia-500/30 px-1 py-0.5 rounded shrink-0" title="Roteiro anexado ao Roteirização">🔗 Roteiro</span>
              )}
            </div>
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
        {post.adjustmentSource && (
          <div className="mt-1.5 space-y-1.5" onClick={(e) => e.preventDefault()}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={ajusteFeito}
                disabled={busy}
                className="text-[10px] px-2 py-1 rounded bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 border border-violet-500/30 disabled:opacity-50 transition-colors"
                title="Reenvia p/ revisão interna e copia a mensagem (com o ajuste)"
              >
                ✅ Ajuste feito (copia msg)
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDrive((s) => !s); }}
                disabled={busy}
                className="text-[10px] px-2 py-1 rounded bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 disabled:opacity-50 transition-colors"
                title="Atualizar o link do Drive com o post ajustado"
              >
                🔗 Novo link Drive
              </button>
            </div>
            {showDrive && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  placeholder="Cole o novo link do Drive"
                  className="flex-1 min-w-0 bg-[#0f0f0f] border border-white/15 rounded px-2 py-1 text-white text-[10px] outline-none focus:border-blue-500 placeholder-gray-600"
                />
                <button
                  type="button"
                  onClick={saveDriveLink}
                  disabled={busy || !driveLink.trim()}
                  className="text-[10px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-40 transition-colors shrink-0"
                >
                  Salvar
                </button>
              </div>
            )}
          </div>
        )}
      </Link>

      {/* Menu de ações no canto do card */}
      <div className="absolute top-1 right-1 z-10">
        <PostActionsMenu
          postId={post.id}
          clientId={post.clientId}
          clientToken={post.clientToken}
          internalMsg={internalMsg}
          needsAdjustment={!!post.adjustmentSource}
          onBusyChange={setBusy}
        />
      </div>
    </div>
  );
}
