"use client";

import { useCallback, useEffect, useState } from "react";

interface CoverItem {
  id: string;
  fileUrl: string;
  fileType: string;
  contentType: string;
  title: string | null;
  caption: string | null;
  coverUrl: string | null;
  coverDriveUrl: string | null;
  driveUrl: string | null;
}

export default function CoverApprovalPage({ params }: { params: { token: string } }) {
  const [name, setName] = useState<string>("");
  const [items, setItems] = useState<CoverItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cover/${params.token}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setName(d.name || "");
      setItems(d.contentItems ?? []);
      setTotal((prev) => Math.max(prev, (d.contentItems ?? []).length));
    } catch {
      setErro("Link inválido ou indisponível.");
    }
  }, [params.token]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    if (action === "reject" && !confirm("Pedir uma nova capa? A capa atual será removida e o vídeo volta para a etapa de criar capa.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/cover/${params.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: id, action }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wider">Aprovação de capa</p>
          <h1 className="text-xl font-semibold mt-0.5">{name || "Capas"}</h1>
          <p className="text-gray-400 text-sm mt-1">Revise a capa de cada vídeo. Aprove para liberar para programação, ou peça uma nova.</p>
        </div>

        {erro ? (
          <p className="text-amber-400 text-sm">{erro}</p>
        ) : items === null ? (
          <p className="text-gray-500 text-sm">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-emerald-300 font-medium">{total > 0 ? "Todas as capas foram revisadas!" : "Nenhuma capa aguardando aprovação."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-white text-sm font-medium">{it.title || "(sem título)"}</p>
                </div>

                {/* Capa */}
                <div className="px-4 pt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Capa proposta</p>
                  {it.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.coverUrl} alt="Capa" className="w-full max-h-[460px] object-contain rounded-lg bg-black" />
                  ) : (
                    <div className="bg-black/40 rounded-lg p-8 text-center text-gray-500 text-sm">Sem prévia da capa.</div>
                  )}
                  {it.coverDriveUrl && (
                    <a href={it.coverDriveUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300">
                      🔗 Ver capa no Drive
                    </a>
                  )}
                </div>

                {/* Vídeo (referência) */}
                {it.driveUrl && (
                  <div className="px-4 pt-3">
                    <a href={it.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-gray-300 hover:text-white">
                      ▶ Ver o vídeo no Drive
                    </a>
                  </div>
                )}

                <div className="p-4 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => act(it.id, "approve")}
                    disabled={busyId === it.id}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {busyId === it.id ? "..." : "✅ Aprovar capa"}
                  </button>
                  <button
                    onClick={() => act(it.id, "reject")}
                    disabled={busyId === it.id}
                    className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium border border-white/15 transition-colors disabled:opacity-50"
                  >
                    {busyId === it.id ? "..." : "↩️ Pedir nova capa"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
