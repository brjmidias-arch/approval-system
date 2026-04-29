"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CopyButton from "./CopyButton";
import PlannerCalendar from "./PlannerCalendar";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
};

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

interface Post {
  id: string;
  groupId: string | null;
  title: string | null;
  caption: string | null;
  driveUrl: string | null;
  coverUrl: string | null;
  coverDriveUrl: string | null;
  scheduledDate: Date | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  approvedAt: Date | null;
  postedAt: Date | null;
  campaignId: string;
}

interface CampaignGroup {
  id: string;
  name: string;
  month: number;
  year: number;
  posts: Post[];
}

interface ClientGroup {
  clientId: string;
  clientName: string;
  campaigns: CampaignGroup[];
  totalPosts: number;
  scheduledPosts: number;
  postedPosts: number;
  pendingPosts: number;
  maxDaysWaiting: number;
}

function PostCard({ post, onMarkPosted }: { post: Post; onMarkPosted: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [isPosted, setIsPosted] = useState(!!post.postedAt);
  const [driveUrl, setDriveUrl] = useState(post.driveUrl || "");
  const [editingDrive, setEditingDrive] = useState(false);
  const [savingDrive, setSavingDrive] = useState(false);

  async function handleSaveDrive() {
    setSavingDrive(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${post.campaignId}/items/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl: driveUrl || null }),
      });
      if (!res.ok) throw new Error();
      setEditingDrive(false);
    } catch {
      alert("Erro ao salvar link do Drive. Tente novamente.");
    } finally {
      setSavingDrive(false);
    }
  }

  async function handleMarkPosted() {
    if (isPosted) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${post.campaignId}/items/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      setIsPosted(true);
      onMarkPosted(post.id);
    } catch {
      alert("Erro ao marcar como agendado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isPosted ? "bg-[#111111] border-white/5 opacity-60" : "bg-[#111111] border-emerald-500/20"}`}>
      <div className="flex items-start gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
          {post.fileType === "IMAGE" ? (
            <img src={post.fileUrl} alt="" className="w-full h-full object-cover" />
          ) : post.fileType === "VIDEO" ? (
            <span className="text-2xl">🎬</span>
          ) : (
            <span className="text-2xl">📄</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {post.title && (
              <span className="text-white text-sm font-medium">{post.title}</span>
            )}
            <span className="text-xs font-medium text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded">
              {CONTENT_TYPE_LABELS[post.contentType] || post.contentType}
            </span>
            {post.scheduledDate && (
              <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                📅 {new Date(post.scheduledDate!).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </span>
            )}
            {isPosted ? (
              <span className="text-xs text-gray-400">✅ Agendado</span>
            ) : (
              <span className="text-xs text-emerald-400">✅ Aprovado</span>
            )}
          </div>

          {/* Drive links */}
          <div className="flex flex-wrap gap-2 mt-1 items-center">
            {editingDrive ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveDrive(); if (e.key === "Escape") setEditingDrive(false); }}
                  placeholder="Cole o link do Drive..."
                  autoFocus
                  className="flex-1 bg-black/40 border border-blue-500/40 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-400 placeholder-gray-600"
                />
                <button onClick={handleSaveDrive} disabled={savingDrive} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors">
                  {savingDrive ? "..." : "Salvar"}
                </button>
                <button onClick={() => setEditingDrive(false)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 transition-colors">
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                {driveUrl ? (
                  <a href={driveUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                    🔗 Arquivo no Drive
                  </a>
                ) : (
                  <span className="text-xs text-gray-600 inline-block self-center">Sem link do Drive</span>
                )}
                <button
                  onClick={() => setEditingDrive(true)}
                  className="text-xs text-gray-500 hover:text-blue-400 transition-colors underline"
                >
                  {driveUrl ? "Editar link" : "+ Adicionar link"}
                </button>
              </>
            )}
            {post.contentType === "REELS" && post.coverDriveUrl && (
              <a href={post.coverDriveUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-900/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors">
                🖼️ Capa no Drive
              </a>
            )}
          </div>

          {/* Cover preview */}
          {post.contentType === "REELS" && post.coverUrl && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Capa do Reels</p>
              <img src={post.coverUrl} alt="Capa" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
            </div>
          )}
        </div>

        {/* Mark as posted button */}
        <div className="shrink-0">
          {isPosted ? (
            <span className="text-xs text-gray-500 bg-white/5 px-3 py-2 rounded-lg">Agendado ✓</span>
          ) : (
            <button
              onClick={handleMarkPosted}
              disabled={loading}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {loading ? "Salvando..." : "Marcar como Agendado"}
            </button>
          )}
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <div className="border-t border-white/5 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Legenda</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
          <CopyButton text={post.caption} />
        </div>
      )}
    </div>
  );
}

export default function ClientScheduleAccordion({ clients: initialClients }: { clients: ClientGroup[] }) {
  const [clients, setClients] = useState(initialClients);
  const [openClientId, setOpenClientId] = useState<string | null>(
    initialClients.length === 1 ? initialClients[0].clientId
    : initialClients[0]?.pendingPosts > 0 ? initialClients[0].clientId
    : null
  );
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set());
  const [plannerClientId, setPlannerClientId] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPlannerClientId(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function handleDateChange(postId: string, dateKey: string | null) {
    setClients((prev) => prev.map((client) => ({
      ...client,
      campaigns: client.campaigns.map((campaign) => ({
        ...campaign,
        posts: campaign.posts.map((post) => {
          if (post.id !== postId) return post;
          if (!dateKey) return { ...post, scheduledDate: null };
          const [y, m, d] = dateKey.split("-").map(Number);
          return { ...post, scheduledDate: new Date(y, m - 1, d, 12, 0, 0) };
        }),
      })),
    })));
  }

  function handleMarkPosted(postId: string) {
    setPostedIds((prev) => new Set(prev).add(postId));
  }

  const plannerClient = clients.find((c) => c.clientId === plannerClientId);
  const plannerPosts = plannerClient
    ? plannerClient.campaigns.flatMap((camp) =>
        camp.posts.map((p) => ({
          id: p.id,
          title: p.title,
          contentType: p.contentType,
          fileUrl: p.fileUrl,
          fileType: p.fileType,
          coverUrl: p.coverUrl,
          caption: p.caption,
          scheduledDate: p.scheduledDate ? new Date(p.scheduledDate).toISOString() : null,
          clientName: plannerClient.clientName,
          campaignName: camp.name,
          campaignId: p.campaignId,
        }))
      )
    : [];

  if (clients.length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-10 text-center">
        <p className="text-2xl mb-3">📅</p>
        <p className="text-gray-400">Nenhum post aprovado ainda.</p>
        <p className="text-gray-600 text-sm mt-1">Posts aparecem aqui quando o cliente aprovar.</p>
      </div>
    );
  }

  return (
    <>
    {/* Planner modal */}
    {plannerClient && (
      <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 bg-[#111] border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white font-semibold">Planner — {plannerClient.clientName}</h2>
            <p className="text-gray-500 text-xs mt-0.5">Arraste os posts para definir as datas de publicação</p>
          </div>
          <button
            onClick={() => setPlannerClientId(null)}
            className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
          >×</button>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <PlannerCalendar initialPosts={plannerPosts} clientId={plannerClient.clientId} onDateChange={handleDateChange} />
        </div>
      </div>
    )}
    <div className="space-y-3">
      {clients.map((client) => {
        const isOpen = openClientId === client.clientId;
        const pendingCount = client.pendingPosts - Array.from(postedIds).filter(id =>
          client.campaigns.flatMap(c => c.posts).some(p => p.id === id && !p.postedAt)
        ).length;
        const days = client.maxDaysWaiting;
        const urgencyBorder = pendingCount > 0
          ? days >= 7 ? "border-l-red-500"
          : days >= 3 ? "border-l-amber-500"
          : days >= 1 ? "border-l-yellow-600"
          : "border-l-emerald-500/40"
          : "border-l-white/10";
        const urgencyBg = pendingCount > 0
          ? days >= 7 ? "bg-red-900/10"
          : days >= 3 ? "bg-amber-900/10"
          : "bg-[#1a1a1a]"
          : "bg-[#1a1a1a]";

        return (
          <div key={client.clientId} className={`border border-white/10 border-l-2 ${urgencyBorder} ${urgencyBg} rounded-xl overflow-hidden`}>
            {/* Client header */}
            <button
              onClick={() => setOpenClientId(isOpen ? null : client.clientId)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-white font-semibold">{client.clientName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-gray-500 text-xs">
                      {client.totalPosts} {client.totalPosts === 1 ? "post aprovado" : "posts aprovados"}
                      {client.scheduledPosts > 0 && ` · ${client.scheduledPosts} no planner`}
                      {client.postedPosts > 0 && ` · ${client.postedPosts} publicados`}
                    </p>
                    {pendingCount > 0 && days > 0 && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        days >= 7 ? "bg-red-900/40 text-red-400 border border-red-500/30 animate-pulse"
                        : days >= 3 ? "bg-amber-900/40 text-amber-400 border border-amber-500/30"
                        : "bg-yellow-900/20 text-yellow-500 border border-yellow-600/20"
                      }`}>
                        ⏰ {pendingCount} {pendingCount === 1 ? "post" : "posts"} sem agendar há {days} {days === 1 ? "dia" : "dias"}
                      </span>
                    )}
                    {pendingCount > 0 && days === 0 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-500/20">
                        {pendingCount} {pendingCount === 1 ? "post aprovado hoje" : "posts aprovados hoje"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setPlannerClientId(client.clientId); }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-900/30 hover:bg-violet-900/50 text-violet-400 border border-violet-500/30 transition-colors"
                >
                  📅 Planner
                </button>
                <span className={`text-gray-400 text-lg transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>›</span>
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-white/5 px-5 py-4 space-y-6">
                {client.campaigns.map((campaign) => (
                  <div key={campaign.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 text-sm font-medium">{campaign.name}</p>
                        <p className="text-gray-600 text-xs">{MONTHS[campaign.month - 1]} {campaign.year} · {campaign.posts.length} posts</p>
                      </div>
                      <Link href={`/admin/campaigns/${campaign.id}`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        Ver campanha →
                      </Link>
                    </div>

                    <div className="space-y-3">
                      {campaign.posts.map((post) => (
                        <PostCard key={post.id} post={post} onMarkPosted={handleMarkPosted} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}
