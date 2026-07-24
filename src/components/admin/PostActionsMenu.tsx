"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Menu de ações por post (botão "⋯" + dropdown). Fonte única das ações
 * disponíveis no dashboard — usado no Kanban e na Lista.
 */
export default function PostActionsMenu({
  postId,
  clientId,
  onBusyChange,
}: {
  postId: string;
  clientId: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  async function run(makeReq: () => Promise<Response>, confirmMsg?: string) {
    if (busy) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setOpen(false);
    setBusyState(true);
    try {
      const res = await makeReq();
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Erro ao aplicar a ação. Tente novamente.");
    } finally {
      setBusyState(false);
    }
  }

  const patch = (body: Record<string, unknown>) => () =>
    fetch(`/api/admin/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const del = () => fetch(`/api/admin/posts/${postId}`, { method: "DELETE" });

  const actions: { label: string; onClick: () => void; danger?: boolean }[] = [
    { label: "🔍 Enviar p/ revisão interna", onClick: () => run(patch({ action: "send-internal" })) },
    { label: "👤 Enviar p/ cliente", onClick: () => run(patch({ action: "send-client" })) },
    { label: "📅 Enviar p/ programação", onClick: () => run(patch({ sentToProgramacao: true })) },
    { label: "✅ Concluir (marcar publicado)", onClick: () => run(patch({ action: "mark-published" }), "Concluir este post? Ele vai para a aba Concluído.") },
    { label: "🗑 Excluir", onClick: () => run(del, "Excluir este post? Esta ação não pode ser desfeita."), danger: true },
  ];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={busy}
        aria-label="Opções do post"
        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        {busy ? "…" : "⋯"}
      </button>

      {open && (
        <>
          {/* backdrop pra fechar ao clicar fora */}
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute top-7 right-0 z-30 w-52 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  a.onClick();
                }}
                className={`w-full text-left text-xs px-3 py-2 transition-colors hover:bg-white/[0.06] ${
                  a.danger ? "text-red-400" : "text-gray-200"
                }`}
              >
                {a.label}
              </button>
            ))}
            <div className="border-t border-white/5 my-1" />
            <Link
              href={`/admin/clients/${clientId}`}
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
