"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FolderUploadModal from "@/components/admin/FolderUploadModal";

type ClientOpt = { id: string; name: string; itemCount: number };

export default function DashboardUploadButton({ clients }: { clients: ClientOpt[] }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ClientOpt | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;

  function close() {
    setPicking(false);
    setQuery("");
    setChosen(null);
  }

  return (
    <>
      <button
        onClick={() => setPicking(true)}
        className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
      >
        📤 Enviar roteiros
      </button>

      {/* Passo 1: escolher o cliente */}
      {picking && !chosen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold text-base">Enviar roteiros para aprovação</h2>
              <button onClick={close} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-gray-400 text-xs">
                Escolha o cliente. Depois é só colar os links do Drive — um por linha vira um post/carrossel (dá pra subir vários de uma vez).
              </p>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500/50 placeholder-gray-600"
              />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {filtered.length === 0 ? (
                  <p className="text-gray-600 text-sm px-1 py-2">Nenhum cliente encontrado.</p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChosen(c)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/10 text-white text-sm flex items-center justify-between transition-colors"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-gray-500 text-xs shrink-0 ml-2">
                        {c.itemCount} {c.itemCount === 1 ? "post" : "posts"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Passo 2: reaproveita o fluxo de upload em massa já existente */}
      {chosen && (
        <FolderUploadModal
          clientId={chosen.id}
          clientName={chosen.name}
          existingItemCount={chosen.itemCount}
          onDone={() => router.refresh()}
          onClose={close}
        />
      )}
    </>
  );
}
