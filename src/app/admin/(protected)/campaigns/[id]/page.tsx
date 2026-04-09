"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CONTENT_TYPE_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from "@/types";
import type { ContentType, ApprovalStatus } from "@/types";

interface ApprovalItem {
  id: string;
  status: ApprovalStatus;
  clientComment: string | null;
  reviewedAt: string | null;
}

interface ContentItem {
  id: string;
  fileUrl: string;
  fileType: string;
  caption: string | null;
  scheduledDate: string | null;
  contentType: ContentType;
  order: number;
  approvalItem: ApprovalItem | null;
}

interface Campaign {
  id: string;
  name: string;
  month: number;
  year: number;
  token: string;
  expiresAt: string;
  status: string;
  client: { id: string; name: string; email: string };
  contentItems: ContentItem[];
}

const CONTENT_TYPES: ContentType[] = ["POST_FEED", "CARROSSEL", "REELS", "STORIES"];

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    caption: "",
    scheduledDate: "",
    contentType: "POST_FEED" as ContentType,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [liveStatus, setLiveStatus] = useState<{ reviewed: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCarousel = uploadForm.contentType === "CARROSSEL";

  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/admin/campaigns/${id}`);
    const data = await res.json();
    setCampaign(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/admin/campaigns/${id}/status`);
      if (res.ok) {
        const data = await res.json();
        setLiveStatus({ reviewed: data.reviewed, total: data.total });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [id]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    setUploading(true);

    const baseOrder = (campaign?.contentItems.length || 0) + 1;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress(`Enviando ${i + 1}/${selectedFiles.length}...`);

      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });

      if (!uploadRes.ok) {
        alert(`Erro ao enviar o arquivo "${file.name}".`);
        continue;
      }

      const { url, fileType } = await uploadRes.json();

      await fetch(`/api/admin/campaigns/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: url,
          fileType,
          caption: uploadForm.caption,
          scheduledDate: uploadForm.scheduledDate || null,
          contentType: uploadForm.contentType,
          order: baseOrder + i,
        }),
      });
    }

    setUploading(false);
    setUploadProgress("");
    setShowUploadForm(false);
    setSelectedFiles([]);
    setUploadForm({ caption: "", scheduledDate: "", contentType: "POST_FEED" });
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchCampaign();
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Remover este item?")) return;
    await fetch(`/api/admin/campaigns/${id}/items/${itemId}`, { method: "DELETE" });
    fetchCampaign();
  }

  function copyLink() {
    const url = `${window.location.origin}/aprovar/${campaign!.token}`;
    navigator.clipboard.writeText(url);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  async function handleResend() {
    await fetch(`/api/admin/campaigns/${id}/resend`, { method: "POST" });
    alert("E-mail reenviado com sucesso!");
  }

  async function handleToggleStatus() {
    const newStatus = campaign!.status === "OPEN" ? "CLOSED" : "OPEN";
    await fetch(`/api/admin/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchCampaign();
  }

  if (loading) return <div className="text-gray-400 p-8">Carregando...</div>;
  if (!campaign) return <div className="text-red-400 p-8">Campanha não encontrada.</div>;

  const total = campaign.contentItems.length;
  const approved = campaign.contentItems.filter((i) => i.approvalItem?.status === "APPROVED").length;
  const adjustment = campaign.contentItems.filter((i) => i.approvalItem?.status === "ADJUSTMENT").length;
  const rejected = campaign.contentItems.filter((i) => i.approvalItem?.status === "REJECTED").length;
  const pending = total - approved - adjustment - rejected;
  const isExpired = new Date() > new Date(campaign.expiresAt) && campaign.status === "OPEN";
  const approvalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/aprovar/${campaign.token}`;

  // Group carousel items together for display
  type GroupedItem =
    | { type: "single"; item: ContentItem }
    | { type: "carousel"; items: ContentItem[] };

  const grouped: GroupedItem[] = [];
  let i = 0;
  while (i < campaign.contentItems.length) {
    const item = campaign.contentItems[i];
    if (item.contentType === "CARROSSEL") {
      const slides: ContentItem[] = [item];
      while (
        i + 1 < campaign.contentItems.length &&
        campaign.contentItems[i + 1].contentType === "CARROSSEL"
      ) {
        i++;
        slides.push(campaign.contentItems[i]);
      }
      grouped.push({ type: "carousel", items: slides });
    } else {
      grouped.push({ type: "single", item });
    }
    i++;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/admin" className="hover:text-white">Dashboard</Link>
          <span>/</span>
          <Link href={`/admin/clients/${campaign.client.id}`} className="hover:text-white">
            {campaign.client.name}
          </Link>
          <span>/</span>
          <span className="text-white">{campaign.name}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white">{campaign.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                campaign.status === "CLOSED" ? "bg-gray-800 text-gray-400"
                : isExpired ? "bg-red-900/30 text-red-400"
                : "bg-emerald-900/30 text-emerald-400"
              }`}>
                {campaign.status === "CLOSED" ? "Fechado" : isExpired ? "Expirado" : "Aberto"}
              </span>
              {liveStatus && liveStatus.reviewed < liveStatus.total && campaign.status === "OPEN" && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Cliente revisando
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-0.5">
              {campaign.client.name} · Expira {new Date(campaign.expiresAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button onClick={copyLink} className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors">
              {copyFeedback ? "Copiado!" : "Copiar Link"}
            </button>
            <button onClick={handleResend} className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors">
              Reenviar E-mail
            </button>
            <button onClick={handleToggleStatus} className={`text-sm px-3 py-2 rounded-lg transition-colors ${
              campaign.status === "OPEN" ? "bg-red-900/20 hover:bg-red-900/30 text-red-400" : "bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-400"
            }`}>
              {campaign.status === "OPEN" ? "Fechar Campanha" : "Reabrir Campanha"}
            </button>
            <button onClick={() => setShowUploadForm(true)} className="text-sm px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
              + Upload
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: total, color: "text-white" },
          { label: "Aprovado", value: approved, color: "text-emerald-400" },
          { label: "Ajuste", value: adjustment, color: "text-amber-400" },
          { label: "Reprovado", value: rejected, color: "text-red-400" },
          { label: "Pendente", value: pending, color: "text-gray-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-xs">{stat.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Approval URL */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-gray-400 text-sm shrink-0">Link do cliente:</span>
        <input readOnly value={approvalUrl} className="flex-1 bg-transparent text-sm text-gray-300 focus:outline-none" />
        <button onClick={copyLink} className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors shrink-0">
          {copyFeedback ? "Copiado!" : "Copiar"}
        </button>
      </div>

      {/* Upload Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-medium mb-4">Upload de Conteúdo</h2>
            <form onSubmit={handleUpload} className="space-y-4">

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Tipo de conteúdo</label>
                <select
                  value={uploadForm.contentType}
                  onChange={(e) => {
                    setUploadForm({ ...uploadForm, contentType: e.target.value as ContentType });
                    setSelectedFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  {CONTENT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>{CONTENT_TYPE_LABELS[ct]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  {isCarousel ? "Slides do carrossel (selecione todos de uma vez)" : "Arquivo"}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,application/pdf"
                  multiple={isCarousel}
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                  required
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 file:mr-3 file:py-1 file:px-3 file:bg-white/10 file:text-gray-300 file:rounded file:border-0 file:text-sm cursor-pointer"
                />
                {isCarousel && (
                  <p className="text-amber-400/80 text-xs mt-1">
                    Para carrossel: segure Ctrl (ou Cmd) para selecionar múltiplas imagens de uma vez
                  </p>
                )}
                {selectedFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedFiles.map((f, idx) => (
                      <span key={idx} className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded">
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-gray-500 text-xs mt-1">JPG, PNG, WebP, MP4 ou PDF — máx. 100MB cada</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Legenda sugerida <span className="text-gray-600">(opcional)</span>
                </label>
                <textarea
                  value={uploadForm.caption}
                  onChange={(e) => setUploadForm({ ...uploadForm, caption: e.target.value })}
                  rows={3}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="Texto que será publicado junto com o conteúdo..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Data prevista de publicação <span className="text-gray-600">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={uploadForm.scheduledDate}
                  onChange={(e) => setUploadForm({ ...uploadForm, scheduledDate: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowUploadForm(false); setSelectedFiles([]); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || selectedFiles.length === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm transition-colors font-medium"
                >
                  {uploading ? uploadProgress : `Enviar${selectedFiles.length > 1 ? ` (${selectedFiles.length} arquivos)` : ""}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Items */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10">
          <h2 className="text-white font-medium text-sm">Conteúdos ({total} itens)</h2>
        </div>

        {total === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhum conteúdo adicionado ainda.</p>
            <button onClick={() => setShowUploadForm(true)} className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
              Fazer primeiro upload →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {grouped.map((group, gi) => {
              if (group.type === "single") {
                const item = group.item;
                const statusKey = (item.approvalItem?.status || "PENDING") as ApprovalStatus;
                return (
                  <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                      {item.fileType === "IMAGE" ? (
                        <img src={item.fileUrl} alt="" className="w-full h-full object-cover" />
                      ) : item.fileType === "VIDEO" ? (
                        <span className="text-2xl">🎬</span>
                      ) : (
                        <span className="text-2xl">📄</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                          {CONTENT_TYPE_LABELS[item.contentType]}
                        </span>
                        {item.scheduledDate && (
                          <span className="text-xs text-gray-500">
                            {new Date(item.scheduledDate).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      {item.caption && <p className="text-sm text-gray-300 line-clamp-2">{item.caption}</p>}
                      {item.approvalItem?.clientComment && (
                        <div className="mt-1.5 text-xs text-gray-400 bg-white/5 rounded-lg px-2.5 py-1.5">
                          <span className="text-gray-500">Comentário: </span>
                          {item.approvalItem.clientComment}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${APPROVAL_STATUS_COLORS[statusKey]}`}>
                        {APPROVAL_STATUS_LABELS[statusKey]}
                      </span>
                      <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-400 text-sm transition-colors">
                        Remover
                      </button>
                    </div>
                  </div>
                );
              }

              // Carousel group
              const slides = group.items;
              const firstItem = slides[0];
              return (
                <div key={`carousel-${gi}`} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                      Carrossel — {slides.length} slides
                    </span>
                    {firstItem.scheduledDate && (
                      <span className="text-xs text-gray-500">
                        {new Date(firstItem.scheduledDate).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {slides.map((slide, si) => {
                      const statusKey = (slide.approvalItem?.status || "PENDING") as ApprovalStatus;
                      return (
                        <div key={slide.id} className="shrink-0 w-24">
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-black/40 relative">
                            {slide.fileType === "IMAGE" ? (
                              <img src={slide.fileUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                            )}
                            <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">
                              {si + 1}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${APPROVAL_STATUS_COLORS[statusKey]}`}>
                              {APPROVAL_STATUS_LABELS[statusKey]}
                            </span>
                            <button onClick={() => handleDeleteItem(slide.id)} className="text-red-500 hover:text-red-400 text-xs">
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {firstItem.caption && (
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2">{firstItem.caption}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
