"use client";

import { useState } from "react";
import KanbanCard, { KanbanCardData } from "@/components/admin/KanbanCard";

/**
 * Coluna "Concluído" do Kanban — recolhida por padrão (minimizada). Clicar no
 * cabeçalho expande para ver os posts concluídos.
 */
export default function ConcluidoColumn({
  stage,
  posts,
}: {
  stage: { label: string; icon: string; color: string; bg: string };
  posts: KanbanCardData[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`shrink-0 flex flex-col ${open ? "w-72" : "w-56"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-2 py-2 rounded-t-lg border-b-2 ${stage.bg} w-full text-left`}
      >
        <span className="text-sm">{stage.icon}</span>
        <h2 className={`text-xs font-semibold ${stage.color}`}>{stage.label}</h2>
        <span className="text-[11px] text-gray-500 ml-auto">{posts.length}</span>
        <span className="text-gray-400 text-[10px]">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="bg-[#141414] border border-white/[0.06] rounded-b-lg p-1.5 space-y-1.5 min-h-[80px] flex-1">
          {posts.length === 0 ? (
            <p className="text-[11px] text-gray-600 text-center py-4">—</p>
          ) : (
            posts.map((p) => <KanbanCard key={p.id} post={p} />)
          )}
        </div>
      )}
    </div>
  );
}
