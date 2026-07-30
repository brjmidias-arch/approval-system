"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import CopyButton from "@/components/admin/CopyButton";
import { type SchedulablePost } from "@/lib/programacao";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
};

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  posts: SchedulablePost[];
}
interface Data {
  clientName: string;
  campaigns: CampaignGroup[];
}

export default function ProgramarPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [savingDateId, setSavingDateId] = useState<string | null>(null);
  const [needDateId, setNeedDateId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/programar/${clientId}`, { cache: "no-store" });
      if (!res.ok) { setNotFound(true); return; }
      const json: Data = await res.json();
      setData(json);
      // Semeia o campo de data com o que já veio do dashboard (formato YYYY-MM-DD).
      const seed: Record<string, string> = {};
      for (const c of json.campaigns ?? []) for (const p of c.posts) {
        seed[p.id] = p.scheduledDate ? new Date(p.scheduledDate).toISOString().slice(0, 10) : "";
      }
      setDates(seed);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-save da data digitada no link (grava no post; carrossel = grupo todo).
  async function saveDate(postId: string, value: string) {
    setDates((prev) => ({ ...prev, [postId]: value }));
    if (value) setNeedDateId((cur) => (cur === postId ? null : cur));
    setSavingDateId(postId);
    try {
      await fetch(`/api/programar/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: postId, scheduledDate: value || null, action: "set-date" }),
      });
    } catch {
      // best-effort: a data também é reenviada ao clicar em "Agendado".
    } finally {
      setSavingDateId(null);
    }
  }

  async function markPosted(postId: string) {
    const date = dates[postId];
    if (!date) { setNeedDateId(postId); return; }
    setNeedDateId(null);
    setMarkingId(postId);
    try {
      const res = await fetch(`/api/programar/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: postId, scheduledDate: date }),
      });
      if (!res.ok) throw new Error();
      setData((prev) =>
        prev
          ? {
              ...prev,
              campaigns: prev.campaigns
                .map((c) => ({ ...c, posts: c.posts.filter((p) => p.id !== postId) }))
                .filter((c) => c.posts.length > 0),
            }
          : prev
      );
    } catch {
      alert("Erro ao marcar como agendado. Tente novamente.");
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0f0f0f] text-gray-400 p-8">Carregando...</div>;
  if (notFound || !data) return <div className="min-h-screen bg-[#0f0f0f] text-red-400 p-8">Cliente não encontrado.</div>;

  const totalPosts = data.campaigns.reduce((s, c) => s + c.posts.length, 0);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">{data.clientName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {totalPosts === 0
              ? "Nenhum post para agendar no momento."
              : `${totalPosts} ${totalPosts === 1 ? "post para agendar" : "posts para agendar"}`}
          </p>
        </div>

        {data.campaigns.map((camp) => (
          <div key={camp.campaignId} className="space-y-2">
            <h2 className="text-sm font-medium text-gray-300">{camp.campaignName}</h2>
            {camp.posts.map((post) => {
              const hasDriveLinks = post.driveUrl || (post.contentType === "REELS" && post.coverDriveUrl);
              return (
                <div key={post.id} className="bg-[#1a1a1a] border border-white/[0.08] rounded-xl overflow-hidden">
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                      {post.fileType === "IMAGE" ? (
                        <img src={post.fileUrl} alt="" className="w-full h-full object-cover" />
                      ) : post.fileType === "VIDEO" ? (
                        <span className="text-lg">🎬</span>
                      ) : (
                        <span className="text-lg">📄</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {post.title && <p className="text-white text-xs font-medium">{post.title}</p>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
                          {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <label className="text-[11px] text-gray-400 shrink-0">📅 Data do agendamento:</label>
                        <input
                          type="date"
                          value={dates[post.id] ?? ""}
                          onChange={(e) => saveDate(post.id, e.target.value)}
                          style={{ colorScheme: "dark" }}
                          className="bg-[#0f0f0f] border border-white/15 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                        />
                        {savingDateId === post.id && <span className="text-[11px] text-gray-500">salvando…</span>}
                      </div>
                      {needDateId === post.id && !dates[post.id] && (
                        <p className="text-[11px] text-amber-400 pt-1">⚠️ Complete a data do agendamento para agendar este post.</p>
                      )}
                    </div>
                    <button
                      onClick={() => markPosted(post.id)}
                      disabled={markingId === post.id}
                      className="shrink-0 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      {markingId === post.id ? "..." : "Agendado ✓"}
                    </button>
                  </div>

                  {hasDriveLinks && (
                    <div className="border-t border-white/5 px-3 py-2 flex flex-wrap gap-2">
                      {post.driveUrl && (
                        <a href={post.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                          🔗 Arquivo no Drive
                        </a>
                      )}
                      {post.contentType === "REELS" && post.coverDriveUrl && (
                        <a href={post.coverDriveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-900/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors">
                          🖼️ Capa no Drive
                        </a>
                      )}
                    </div>
                  )}

                  {post.caption && (
                    <div className="border-t border-white/5 px-3 py-3">
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                      <div className="mt-2">
                        <CopyButton text={post.caption} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
