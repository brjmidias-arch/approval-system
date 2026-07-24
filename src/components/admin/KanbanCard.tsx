"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface KanbanCardData {
  id: string;
  title: string | null;
  caption: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  clientId: string;
  clientName: string;
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(makeReq: () => Promise<Response>, confirmMsg?: string) {
    if (busy) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setOpen(false);
    setBusy(true);
    try {
      const res = await makeReq();
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Erro ao aplicar a ação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, unknown>) => () =>
    fetch(`/api/admin/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const del = () => fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });

  const actions: { label: string; onClick: () => void; danger?: boolean }[] = [
    { label: "🔍 Enviar p/ revisão interna", onClick: () => run(patch({ action: "send-internal" })) },
    { label: "👤 Enviar p/ cliente", onClick: () => run(patch({ action: "send-client" })) },
    { label: "📅 Enviar p/ programação", onClick: () => run(patch({ sentToProgramacao: true })) },
    { label: "✅ Marcar como publicado", onClick: () => run(patch({ action: "mark-published" }), "Marcar este post como publicado?") },
    { label: "🗑 Excluir", onClick: () => run(del, "Excluir este post? Esta ação não pode ser desfeita."), danger: true },
  ];

  return (
    <div className="relative">
      <Link
        href={`/admin/clients/${post.clientId}`}
        className={`block bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-2 hover:border-white/20 transition-colors ${busy ? "opacity-50" : ""}`}
      >
        <div className="flex items-center gap-2 pr-6">
          <div className="w-8 h-8 rounded-md overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
            {post.fileType === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.fileUrl} alt="" className="w-full h-full object-cover" />
            ) : post.fileType === "VIDEO" ? (
              <span className="text-xs">🎬</span>
            ) : (
              <span className="text-xs">📄</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-[11px] font-medium truncate">{postLabel(post)}</p>
            <p className="text-[10px] text-gray-500 truncate">{post.clientName}</p>
          </div>
        </div>
        {post.adjustmentComment && (
          <p className="text-[10px] text-amber-400 mt-1 line-clamp-2">
            ✏️ {post.adjustmentSource === "cliente" ? "Cliente" : "Interno"}: {post.adjustmentComment}
          </p>
        )}
      </Link>

      {/* Botão de ações */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-label="Opções do post"
        className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        {busy ? "…" : "⋯"}
      </button>

      {/* Menu de ações */}
      {open && (
        <>
          {/* backdrop pra fechar ao clicar fora */}
          <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute top-7 right-1 z-30 w-52 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className={`w-full text-left text-xs px-3 py-2 transition-colors hover:bg-white/[0.06] ${
                  a.danger ? "text-red-400" : "text-gray-200"
                }`}
              >
                {a.label}
              </button>
            ))}
            <div className="border-t border-white/5 my-1" />
            <Link
              href={`/admin/clients/${post.clientId}`}
              className="block text-xs px-3 py-2 text-emerald-400 hover:bg-white/[0.06] transition-colors"
            >
              Abrir workspace do cliente →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
