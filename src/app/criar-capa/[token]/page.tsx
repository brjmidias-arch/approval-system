"use client";

import { useCallback, useEffect, useState } from "react";

interface NeedCoverItem {
  id: string;
  title: string | null;
  caption: string | null;
  fileUrl: string;
  fileType: string;
  contentType: string;
  driveUrl: string | null;
  client: { name: string } | null;
}

export default function DesignerCoverPage({ params }: { params: { token: string } }) {
  const [items, setItems] = useState<NeedCoverItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/design-covers/${params.token}`, { cache: "no-store" });
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
    const link = (links[id] || "").trim();
    if (!link) { alert("Cole o link da capa no Drive."); return; }
    setBusyId(id);
    try {
      const res = await fetch(`/api/design-covers/${params.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: id, coverDriveUrl: link }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error); }
      setLinks((p) => { const n = { ...p }; delete n[id]; return n; });
      await load();
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : "Erro ao enviar a capa. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-pink-400 text-xs font-semibold uppercase tracking-wider">Criar capa</p>
          <h1 className="text-xl font-semibold mt-0.5">Vídeos que precisam de capa</h1>
          <p className="text-gray-400 text-sm mt-1">Abra cada vídeo no Drive, produza a capa e cole o link da capa aqui. Ao enviar, o post vai para aprovação da capa.</p>
        </div>

        {erro ? (
          <p className="text-amber-400 text-sm">{erro}</p>
        ) : items === null ? (
          <p className="text-gray-500 text-sm">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-emerald-300 font-medium">{total > 0 ? "Todas as capas foram enviadas!" : "Nenhum vídeo aguardando capa."}</p>
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
                  {it.driveUrl ? (
                    <a href={it.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-pink-300 hover:text-pink-200 font-medium">
                      ▶ Abrir o vídeo no Drive
                    </a>
                  ) : (
                    <p className="text-gray-500 text-xs">Sem link do vídeo.</p>
                  )}

                  {it.caption && (
                    <p className="text-gray-400 text-xs whitespace-pre-wrap line-clamp-4">{it.caption}</p>
                  )}

                  <div className="pt-1">
                    <label className="block text-xs text-gray-400 mb-1.5">Link da capa produzida (Drive):</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={links[it.id] || ""}
                        onChange={(e) => setLinks((p) => ({ ...p, [it.id]: e.target.value }))}
                        placeholder="Cole o link da capa no Drive"
                        className="flex-1 min-w-0 bg-[#0f0f0f] border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pink-500 placeholder-gray-600"
                      />
                      <button
                        onClick={() => enviar(it.id)}
                        disabled={busyId === it.id || !(links[it.id] || "").trim()}
                        className="py-2 px-4 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-40 shrink-0"
                      >
                        {busyId === it.id ? "Enviando…" : "Enviar capa"}
                      </button>
                    </div>
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
