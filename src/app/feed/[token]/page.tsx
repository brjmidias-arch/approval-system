"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FeedView from "@/components/FeedView";
import type { FeedEntry } from "@/lib/feed";

/**
 * Link público só da prévia do feed (mesmo token do link de aprovação do cliente).
 * Mostra apenas os posts deste cliente que ele já viu. Só visualização.
 */
export default function FeedPreviewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ name: string; entries: FeedEntry[] } | null>(null);
  const [error, setError] = useState<"not_found" | "error" | null>(null);

  useEffect(() => {
    fetch(`/api/approval/${token}/feed`)
      .then(async (r) => {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error("error");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error && e.message === "not_found" ? "not_found" : "error"));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-3">{error === "not_found" ? "🔒" : "⚠️"}</p>
          <p className="text-white font-medium">{error === "not_found" ? "Link inválido" : "Não foi possível carregar o feed"}</p>
          <p className="text-gray-500 text-sm mt-1">{error === "not_found" ? "Este link não existe ou foi removido." : "Tente novamente em instantes."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-white text-lg font-semibold">📱 Prévia do feed</h1>
          <p className="text-gray-400 text-sm">Veja como o perfil vai ficar com os posts planejados. Toque num post para ver a legenda.</p>
        </div>
        {!data ? (
          <p className="text-gray-500 text-sm text-center py-16">Carregando…</p>
        ) : (
          <FeedView
            entries={data.entries}
            profileName={data.name}
            onGoApprove={() => { window.location.href = `/aprovar/${token}`; }}
          />
        )}
      </main>
      <footer className="text-center py-8 text-gray-700 text-xs">BRJ Mídias · Prévia do feed</footer>
    </div>
  );
}
