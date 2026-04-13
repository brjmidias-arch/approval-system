"use client";

import { useState } from "react";
import Link from "next/link";
import CopyButton from "./CopyButton";

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
}

export default function ClientScheduleAccordion({ clients }: { clients: ClientGroup[] }) {
  const [openClientId, setOpenClientId] = useState<string | null>(
    clients.length === 1 ? clients[0].clientId : null
  );

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
    <div className="space-y-3">
      {clients.map((client) => {
        const isOpen = openClientId === client.clientId;

        return (
          <div key={client.clientId} className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
            {/* Client header — clickable */}
            <button
              onClick={() => setOpenClientId(isOpen ? null : client.clientId)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full transition-colors ${isOpen ? "bg-emerald-400" : "bg-white/20"}`} />
                <div>
                  <p className="text-white font-medium">{client.clientName}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {client.totalPosts} {client.totalPosts === 1 ? "post aprovado" : "posts aprovados"} · {client.campaigns.length} {client.campaigns.length === 1 ? "campanha" : "campanhas"}
                  </p>
                </div>
              </div>
              <span className={`text-gray-400 text-lg transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                ›
              </span>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-white/5 px-5 py-4 space-y-6">
                {client.campaigns.map((campaign) => (
                  <div key={campaign.id} className="space-y-3">
                    {/* Campaign header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 text-sm font-medium">{campaign.name}</p>
                        <p className="text-gray-600 text-xs">{MONTHS[campaign.month - 1]} {campaign.year} · {campaign.posts.length} posts</p>
                      </div>
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Ver campanha →
                      </Link>
                    </div>

                    {/* Posts */}
                    <div className="space-y-3">
                      {campaign.posts.map((post) => (
                        <div
                          key={post.id}
                          className="bg-[#111111] border border-emerald-500/20 rounded-xl overflow-hidden"
                        >
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
                                    📅 {new Date(post.scheduledDate).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                                <span className="text-xs text-emerald-400">✅ Aprovado</span>
                              </div>

                              {/* Drive links */}
                              <div className="flex flex-wrap gap-2 mt-1">
                                {post.driveUrl ? (
                                  <a href={post.driveUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                                    🔗 Arquivo no Drive
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-600 inline-block self-center">Sem link do Drive</span>
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
  );
}
