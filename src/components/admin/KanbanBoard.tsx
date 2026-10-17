"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import KanbanCard, { type KanbanCardData } from "@/components/admin/KanbanCard";
import SendWeekPanel from "@/components/admin/SendWeekPanel";

interface Stage {
  id: string;
  label: string;
  icon: string;
  color: string;
  dot: string;
  bg: string;
}

/** Ação de status aplicada ao soltar um card na coluna (null = não é destino de drop). */
const DROP_ACTION: Record<string, string | null> = {
  adjustment: null, // etapa computada (ajuste vem do comentário) — não é destino
  criarCapa: null, // etapa computada (vídeo aprovado sem capa) — não é destino
  aprovarCapa: null, // etapa computada (capa aguardando aprovação) — não é destino
  internal: "send-internal",
  readyForClient: "mark-ready-client",
  clientReview: "send-client",
  readyToSchedule: "mark-approved",
  scheduled: "mark-scheduled",
  published: "mark-published",
  draft: "mark-draft",
};

export default function KanbanBoard({
  stages,
  columns,
  designerToken,
  adjustToken,
}: {
  stages: Stage[];
  columns: Record<string, KanbanCardData[]>;
  designerToken?: string;
  adjustToken?: string;
}) {
  const router = useRouter();
  const [overStage, setOverStage] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ published: true });
  const [busy, setBusy] = useState(false);
  const [copiedStage, setCopiedStage] = useState<string | null>(null);
  const [sendingWeeks, setSendingWeeks] = useState(false);

  // Clientes com posts em "Pronto p/ cliente" (para o envio por semana).
  const readyClients = Array.from(
    new Map((columns.readyForClient ?? []).map((c) => [c.clientId, c] as const)).values(),
  );

  function stageDesignerLink(stageId: string): string | null {
    if (stageId === "adjustment" && adjustToken) return `/ajustes/${adjustToken}`;
    if (stageId === "criarCapa" && designerToken) return `/criar-capa/${designerToken}`;
    return null;
  }

  async function onDropTo(stageId: string, e: React.DragEvent) {
    e.preventDefault();
    setOverStage(null);
    const postId = e.dataTransfer.getData("text/plain");
    const action = DROP_ACTION[stageId];
    if (!postId || !action || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Erro ao mover o post. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    {sendingWeeks && (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4" onClick={() => { setSendingWeeks(false); router.refresh(); }}>
        <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-white font-semibold text-base">📤 Enviar semana para o cliente</h2>
            <button onClick={() => { setSendingWeeks(false); router.refresh(); }} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
          </div>
          <div className="p-5 space-y-5">
            {readyClients.map((c) => (
              <div key={c.clientId} className="space-y-2">
                <p className="text-sm font-medium text-white">{c.clientName}</p>
                <SendWeekPanel clientId={c.clientId} clientToken={c.clientToken} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    <div className={`flex gap-3 overflow-x-auto pb-3 ${busy ? "opacity-70" : ""}`}>
      {stages.map((stage) => {
        const cards = columns[stage.id] ?? [];
        const isCollapsed = collapsed[stage.id];
        const droppable = DROP_ACTION[stage.id] != null;
        const isOver = overStage === stage.id && droppable;

        return (
          <div
            key={stage.id}
            className={`shrink-0 flex flex-col ${isCollapsed ? "w-56" : "w-72"}`}
            onDragOver={droppable ? (e) => { e.preventDefault(); setOverStage(stage.id); } : undefined}
            onDragLeave={droppable ? () => setOverStage((s) => (s === stage.id ? null : s)) : undefined}
            onDrop={droppable ? (e) => onDropTo(stage.id, e) : undefined}
          >
            <div className={`flex items-stretch rounded-t-lg border-b-2 ${stage.bg} ${isOver ? "ring-2 ring-white/40" : ""}`}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [stage.id]: !c[stage.id] }))}
                className="flex items-center gap-2 px-2 py-2 flex-1 min-w-0 text-left"
              >
                <span className="text-sm">{stage.icon}</span>
                <h2 className={`text-xs font-semibold ${stage.color}`}>{stage.label}</h2>
                <span className="text-[11px] text-gray-500 ml-auto">{cards.length}</span>
                <span className="text-gray-400 text-[10px]">{isCollapsed ? "▸" : "▾"}</span>
              </button>
              {stageDesignerLink(stage.id) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${window.location.origin}${stageDesignerLink(stage.id)}`);
                    setCopiedStage(stage.id);
                    setTimeout(() => setCopiedStage((s) => (s === stage.id ? null : s)), 2000);
                  }}
                  title="Copiar link do designer desta etapa"
                  className="px-2 shrink-0 text-[11px] text-gray-300 hover:text-white border-l border-white/10"
                >
                  {copiedStage === stage.id ? "✓ copiado" : "🔗 link"}
                </button>
              )}
              {stage.id === "readyForClient" && cards.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSendingWeeks(true); }}
                  title="Enviar os posts prontos ao cliente, por semana"
                  className="px-2 shrink-0 text-[11px] text-gray-300 hover:text-white border-l border-white/10"
                >
                  📤 enviar semana
                </button>
              )}
            </div>

            {!isCollapsed && (
              <div
                className={`rounded-b-lg p-1.5 space-y-1.5 min-h-[80px] max-h-[calc(100vh-360px)] overflow-y-auto flex-1 border transition-colors ${
                  isOver ? "bg-white/[0.06] border-white/30" : "bg-[#141414] border-white/[0.06]"
                }`}
              >
                {cards.length === 0 ? (
                  <p className="text-[11px] text-gray-600 text-center py-4">{isOver ? "Solte aqui" : "—"}</p>
                ) : (
                  cards.map((p) => <KanbanCard key={p.id} post={p} stageId={stage.id} draggable designerToken={designerToken} />)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}
