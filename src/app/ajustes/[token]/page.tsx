"use client";

import { useCallback, useEffect, useState } from "react";

interface AdjustItem {
  id: string;
  title: string | null;
  caption: string | null;
  fileUrl: string;
  fileType: string;
  contentType: string;
  driveUrl: string | null;
  client: { name: string } | null;
  ajuste: string | null;
  fonte: "cliente" | "interno" | null;
}

export default function DesignerAdjustPage({ params }: { params: { token: string } }) {
  const [items, setItems] = useState<AdjustItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/design-adjustments/${params.token}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setItems(d.contentItems ?? []);
      setTotal((prev) => Math.max(prev, (d.contentItems ?? []).length));
    } catch {
      setErro("Link inválido ou indisponível.");
    }
  }, [params.token]);

  useEffect(() => { load(); }, [load]);

  async function enviar(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/design-adjustments/${params.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: id, driveUrl: (links[id] || "").trim() || undefined }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error); }
      setLinks((p) => { const n = { ...p }; delete n[id]; return n; });
      await load();
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Ajustes</p>
          <h1 className="text-xl font-semibold mt-0.5">Posts que precisam de ajuste</h1>
          <p className="text-gray-400 text-sm mt-1">Veja o ajuste pedido, corrija a arte no Drive e, se trocou o link, cole o novo. Ao marcar como feito, o post volta para a revisão interna.</p>
        </div>

        {erro ? (
          <p className="text-amber-400 text-sm">{erro}</p>
        ) : items === null ? (
          <p className="text-gray-500 text-sm">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-emerald-300 font-medium">{total > 0 ? "Todos os ajustes foram feitos!" : "Nenhum ajuste pendente."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-white text-sm font-medium">{it.title || "(sem título)"}</p>
                  {it.client?.name && <p className="text-gray-500 text-xs mt-0.5">{it.client.name}</p>}
                </div>

                <div className="p-4 space-y-3">
                  {it.ajuste && (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-400 mb-1">✏️ Ajuste pedido {it.fonte === "cliente" ? "pelo cliente" : "na revisão interna"}:</p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{it.ajuste}</p>
                    </div>
                  )}

                  {it.driveUrl && (
                    <a href={it.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200 font-medium">
                      🔗 Abrir arte atual no Drive
                    </a>
                  )}

                  {it.caption && (
                    <p className="text-gray-400 text-xs whitespace-pre-wrap line-clamp-4">{it.caption}</p>
                  )}

                  <div className="pt-1">
                    <label className="block text-xs text-gray-400 mb-1.5">Novo link do Drive (opcional — se trocou a arte de lugar):</label>
                    <input
                      type="text"
                      value={links[it.id] || ""}
                      onChange={(e) => setLinks((p) => ({ ...p, [it.id]: e.target.value }))}
                      placeholder="Cole aqui só se o link mudou"
                      className="w-full bg-[#0f0f0f] border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500 placeholder-gray-600 mb-2"
                    />
                    <button
                      onClick={() => enviar(it.id)}
                      disabled={busyId === it.id}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {busyId === it.id ? "Enviando…" : "✅ Ajuste feito → revisão interna"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
