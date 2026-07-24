"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PostActionsMenu from "@/components/admin/PostActionsMenu";
import PostThumbnail from "@/components/admin/PostThumbnail";

interface DashPost {
  id: string;
  title: string | null;
  caption: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  driveUrl?: string | null;
  scheduledLabel?: string | null;
  adjustmentSource?: "cliente" | "interno" | null;
  adjustmentComment?: string | null;
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
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggleSel(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === posts.length ? new Set() : new Set(posts.map((p) => p.id))));
  }

  async function runBulk(makeReq: (id: string) => Promise<Response>, confirmMsg?: string) {
    if (selected.size === 0 || busy) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      // Sequencial (uma de cada vez) — evita estourar o limite de conexões do banco.
      for (const id of Array.from(selected)) {
        const res = await makeReq(id);
        if (!res.ok) throw new Error();
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      alert("Erro ao aplicar a ação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, unknown>) => (id: string) =>
    fetch(`/api/admin/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const del = (id: string) => fetch(`/api/admin/posts/${id}`, { method: "DELETE" });

  const n = selected.size;

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
          {/* Barra de ações em lote */}
          {n > 0 && (
            <div className="flex items-center gap-2 flex-wrap bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 sticky top-0 z-10">
              <span className="text-xs text-gray-300 font-medium mr-1">{n} selecionado{n === 1 ? "" : "s"}</span>
              <button disabled={busy} onClick={() => runBulk(patch({ action: "send-internal" }))} className="text-xs px-2.5 py-1 rounded-md bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 border border-violet-500/30 disabled:opacity-50 transition-colors">→ Revisão interna</button>
              <button disabled={busy} onClick={() => runBulk(patch({ action: "send-client" }))} className="text-xs px-2.5 py-1 rounded-md bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 disabled:opacity-50 transition-colors">→ Cliente</button>
              <button disabled={busy} onClick={() => runBulk(patch({ sentToProgramacao: true }))} className="text-xs px-2.5 py-1 rounded-md bg-sky-900/40 hover:bg-sky-900/60 text-sky-300 border border-sky-500/30 disabled:opacity-50 transition-colors">→ Programação</button>
              <button disabled={busy} onClick={() => runBulk(patch({ action: "mark-published" }), `Marcar ${n} post(s) como publicado(s)?`)} className="text-xs px-2.5 py-1 rounded-md bg-teal-900/40 hover:bg-teal-900/60 text-teal-300 border border-teal-500/30 disabled:opacity-50 transition-colors">✓ Concluir</button>
              <button disabled={busy} onClick={() => runBulk(del, `Excluir ${n} post(s)? Esta ação não pode ser desfeita.`)} className="text-xs px-2.5 py-1 rounded-md bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 disabled:opacity-50 transition-colors">🗑 Excluir</button>
              <button disabled={busy} onClick={() => setSelected(new Set())} className="text-xs px-2 py-1 text-gray-400 hover:text-white disabled:opacity-50 transition-colors">Limpar</button>
            </div>
          )}

          {/* Selecionar todos */}
          {posts.length > 1 && (
            <label className="flex items-center gap-2 px-1 cursor-pointer select-none">
              <input type="checkbox" checked={n === posts.length && n > 0} onChange={toggleAll} className="accent-emerald-500 w-3.5 h-3.5" />
              <span className="text-[11px] text-gray-500">Selecionar todos</span>
            </label>
          )}

          {posts.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border transition-colors ${
                  isSel ? "bg-emerald-900/15 border-emerald-500/40" : "bg-[#0f0f0f] border-white/[0.06] hover:border-white/15"
                }`}
              >
                <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                  <input type="checkbox" checked={isSel} onChange={() => toggleSel(p.id)} className="accent-emerald-500 w-4 h-4 shrink-0" />
                  <PostThumbnail fileType={p.fileType} fileUrl={p.fileUrl} driveUrl={p.driveUrl} label={postLabel(p)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{postLabel(p)}</p>
                    {p.scheduledLabel && (
                      <p className="text-[11px] text-sky-400 truncate">📅 Programado para {p.scheduledLabel}</p>
                    )}
                    {p.adjustmentComment && (
                      <p className="text-[11px] text-amber-400 truncate">
                        ✏️ {p.adjustmentSource === "cliente" ? "Cliente" : "Interno"}: {p.adjustmentComment}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded shrink-0">
                    {TYPE_LABELS[p.contentType] ?? p.contentType}
                  </span>
                </label>
                <PostActionsMenu postId={p.id} clientId={clientId} />
              </div>
            );
          })}

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
