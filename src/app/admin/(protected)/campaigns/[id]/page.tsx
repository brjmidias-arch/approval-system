"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { CONTENT_TYPE_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from "@/types";
import type { ContentType, ApprovalStatus } from "@/types";
import CarouselCard from "@/components/admin/CarouselCard";
import FolderUploadModal from "@/components/admin/FolderUploadModal";

interface ApprovalItem {
  id: string;
  status: ApprovalStatus;
  clientComment: string | null;
  reviewedAt: string | null;
}

interface InternalReviewItem {
  status: string;
  comment: string | null;
}

interface ContentItem {
  id: string;
  fileUrl: string;
  fileType: string;
  title: string | null;
  caption: string | null;
  scheduledDate: string | null;
  contentType: ContentType;
  groupId: string | null;
  driveUrl: string | null;
  coverUrl: string | null;
  coverDriveUrl: string | null;
  order: number;
  approvalItem: ApprovalItem | null;
  internalReviewItem: InternalReviewItem | null;
}

interface Campaign {
  id: string;
  name: string;
  month: number;
  year: number;
  token: string;
  internalToken: string;
  expiresAt: string;
  status: string;
  client: { id: string; name: string; email: string };
  contentItems: ContentItem[];
}

const CONTENT_TYPES: ContentType[] = ["CARROSSEL", "POST_FEED", "REELS", "STORIES"];

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [liveStatus, setLiveStatus] = useState<{ reviewed: number; total: number } | null>(null);
  const [markingDoneItemId, setMarkingDoneItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const [showFolderUpload, setShowFolderUpload] = useState(false);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Edit modal
  const [editingGroup, setEditingGroup] = useState<{ groupId: string | null; firstItemId: string; items: ContentItem[] } | null>(null);
  const [editForm, setEditForm] = useState({ title: "", caption: "", scheduledDate: "", driveUrl: "" });
  const [addingSlides, setAddingSlides] = useState(false);
  const [newSlideLinks, setNewSlideLinks] = useState("");


  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/admin/campaigns/${id}`, { cache: "no-store" });
    const data = await res.json();
    setCampaign(data);
    setLoading(false);
    const items: { status: string }[] = data.approvalItems ?? [];
    setLiveStatus({ reviewed: items.filter((i) => i.status !== "PENDING").length, total: items.length });
  }, [id]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  useEffect(() => {
    const interval = setInterval(() => fetchCampaign(), 30000);
    return () => clearInterval(interval);
  }, [fetchCampaign]);


  function openEditGroup(items: ContentItem[]) {
    const first = items[0];
    setEditingGroup({ groupId: first.groupId, firstItemId: first.id, items });
    setEditForm({
      title: first.title || "",
      caption: first.caption || "",
      scheduledDate: first.scheduledDate ? first.scheduledDate.split("T")[0] : "",
      driveUrl: first.driveUrl || "",
    });
    setNewSlideLinks("");
  }

  async function handleEditSave() {
    if (!editingGroup) return;
    setAddingSlides(true);

    // Update title/caption/date for all items in group
    for (const item of editingGroup.items) {
      await fetch(`/api/admin/campaigns/${id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title || null,
          caption: editForm.caption || null,
          scheduledDate: editForm.scheduledDate || null,
          driveUrl: editForm.driveUrl || null,
        }),
      });
    }

    // Add new slides from Drive links
    if (newSlideLinks.trim()) {
      const links = newSlideLinks.split("\n").map((l) => l.trim()).filter(Boolean);
      const baseOrder = editingGroup.items[editingGroup.items.length - 1].order + 1;
      for (let i = 0; i < links.length; i++) {
        const url = links[i];
        const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (!m) continue;
        const fileId = m[1];
        await fetch(`/api/admin/campaigns/${id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
            fileType: "IMAGE",
            title: editForm.title || null,
            caption: editForm.caption || null,
            scheduledDate: editForm.scheduledDate || null,
            driveUrl: url,
            contentType: "CARROSSEL",
            groupId: editingGroup.groupId,
            order: baseOrder + i,
          }),
        });
      }
    }

    setAddingSlides(false);
    setEditingGroup(null);
    setNewSlideLinks("");
    fetchCampaign();
  }

  async function handleDeleteGroup(items: ContentItem[]) {
    if (!confirm(`Excluir este post (${items.length} ${items.length === 1 ? "slide" : "slides"})? Esta ação não pode ser desfeita.`)) return;
    for (const item of items) {
      await fetch(`/api/admin/campaigns/${id}/items/${item.id}`, { method: "DELETE" });
    }
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

  async function handleSaveName() {
    if (!nameValue.trim()) return;
    await fetch(`/api/admin/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameValue.trim() }),
    });
    setEditingName(false);
    fetchCampaign();
  }



  async function handleDeleteCampaign() {
    if (!confirm(`Excluir a campanha "${campaign!.name}" e todos os conteúdos? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    window.location.href = `/admin/clients/${campaign!.client.id}`;
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


  async function handleMarkItemDone(itemId: string) {
    setMarkingDoneItemId(itemId);
    try {
      await fetch(`/api/admin/campaigns/${id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetApproval: true }),
      });
      fetchCampaign();
    } catch {
      alert("Erro ao marcar ajuste. Tente novamente.");
    } finally {
      setMarkingDoneItemId(null);
    }
  }

  async function handleResetApprovals() {
    if (!confirm("Isso vai apagar todas as aprovações, ajustes e reprovações do cliente, resetando tudo para Pendente. A campanha será reaberta. Continuar?")) return;
    await fetch(`/api/admin/campaigns/${id}/reset-approvals`, { method: "POST" });
    fetchCampaign();
  }

  async function handleReopen() {
    if (!confirm("Isso vai reabrir a campanha e notificar o cliente por e-mail para revisar novamente. Continuar?")) return;
    const res = await fetch(`/api/admin/campaigns/${id}/reopen`, { method: "POST" });
    if (res.ok) {
      fetchCampaign();
    } else {
      alert("Erro ao reabrir campanha.");
    }
  }

  async function handleResetInternalItem(itemIds: string[]) {
    for (const itemId of itemIds) {
      await fetch(`/api/admin/campaigns/${id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetInternalReview: true }),
      });
    }
    fetchCampaign();
  }

  async function handleSendInternal() {
    if (campaign!.contentItems.length === 0) {
      alert("Adicione pelo menos um conteúdo antes de enviar para revisão interna.");
      return;
    }
    await fetch(`/api/admin/campaigns/${id}/send-internal`, { method: "POST" });
    fetchCampaign();
  }

  async function handleSendClient() {
    if (!confirm("Enviar para o cliente? Isso tornará a campanha visível para aprovação.")) return;
    await fetch(`/api/admin/campaigns/${id}/send-client`, { method: "POST" });
    fetchCampaign();
  }

  function copyInternalLink() {
    const url = `${window.location.origin}/revisar/${campaign!.internalToken}`;
    navigator.clipboard.writeText(url);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  if (loading) return <div className="text-gray-400 p-8">Carregando...</div>;
  if (!campaign) return <div className="text-red-400 p-8">Campanha não encontrada.</div>;

  const approvalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/aprovar/${campaign.token}`;
  const internalReviewUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/revisar/${campaign.internalToken}`;

  // Group carousel items by groupId
  type GroupedItem =
    | { type: "single"; item: ContentItem }
    | { type: "carousel"; items: ContentItem[] };

  const grouped: GroupedItem[] = [];
  const seenGroupIds = new Set<string>();

  for (const item of campaign.contentItems) {
    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seenGroupIds.has(item.groupId)) continue;
      seenGroupIds.add(item.groupId);
      const slides = campaign.contentItems.filter((c) => c.groupId === item.groupId);
      grouped.push({ type: "carousel", items: slides });
    } else {
      grouped.push({ type: "single", item });
    }
  }

  // Stats by group (1 carousel = 1 post)
  const total = grouped.length;
  const approved = grouped.filter((g) => {
    const rep = g.type === "single" ? g.item.approvalItem : g.items[0].approvalItem;
    return rep?.status === "APPROVED";
  }).length;
  const adjustment = grouped.filter((g) => {
    const rep = g.type === "single" ? g.item.approvalItem : g.items[0].approvalItem;
    return rep?.status === "ADJUSTMENT";
  }).length;
  const rejected = grouped.filter((g) => {
    const rep = g.type === "single" ? g.item.approvalItem : g.items[0].approvalItem;
    return rep?.status === "REJECTED";
  }).length;
  const pending = total - approved - adjustment - rejected;

  // Internal stats counted by post/group (carousel = 1 post)
  const internalTotal = grouped.length;
  const getInternalStatus = (g: GroupedItem) => {
    const firstItem = g.type === "single" ? g.item : g.items[0];
    return firstItem.internalReviewItem?.status || "PENDING";
  };
  const internalApproved = grouped.filter((g) => getInternalStatus(g) === "APPROVED").length;
  const internalAdjustment = grouped.filter((g) => getInternalStatus(g) === "ADJUSTMENT").length;
  const internalRejected = grouped.filter((g) => getInternalStatus(g) === "REJECTED").length;
  const internalPending = internalTotal - internalApproved - internalAdjustment - internalRejected;
  const allInternalApproved = internalTotal > 0 && internalApproved === internalTotal;

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
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="bg-[#0f0f0f] border border-emerald-500 rounded-lg px-3 py-1.5 text-white text-lg font-semibold focus:outline-none w-64"
                  />
                  <button onClick={handleSaveName} className="text-emerald-400 hover:text-emerald-300 text-sm">Salvar</button>
                  <button onClick={() => setEditingName(false)} className="text-gray-500 hover:text-gray-300 text-sm">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-white">{campaign.name}</h1>
                  <button
                    onClick={() => { setNameValue(campaign.name); setEditingName(true); }}
                    className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                  >
                    ✏️
                  </button>
                </div>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                campaign.status === "PUBLISHED" ? "bg-teal-900/30 text-teal-400"
                : campaign.status === "CLOSED" ? "bg-gray-800 text-gray-400"
                : campaign.status === "DRAFT" ? "bg-gray-800 text-gray-400"
                : campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE" ? "bg-violet-900/30 text-violet-400"
                : "bg-emerald-900/30 text-emerald-400"
              }`}>
                {campaign.status === "PUBLISHED" ? "Publicado"
                : campaign.status === "CLOSED" ? "Fechado"
                : campaign.status === "DRAFT" ? "Rascunho"
                : campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE" ? "Revisão Interna"
                : "Aberto"}
              </span>
              {liveStatus && liveStatus.reviewed < liveStatus.total && campaign.status === "OPEN" && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Cliente revisando
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-gray-400 text-sm">{campaign.client.name}</span>
              <span className="text-gray-600 text-sm">·</span>
              <span className="text-gray-400 text-sm">
                Prazo: {new Date(campaign.expiresAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* DRAFT: upload + send to internal review */}
            {campaign.status === "DRAFT" && (
              <>
                <button onClick={() => setShowFolderUpload(true)} className="text-sm px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                  + Adicionar conteúdo
                </button>
                <button onClick={handleSendInternal} className="text-sm px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors">
                  Enviar para Revisão Interna
                </button>
              </>
            )}

            {/* INTERNAL_REVIEW / INTERNAL_DONE: copy internal link */}
            {(campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE") && (
              <>
                <button onClick={() => setShowFolderUpload(true)} className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors">
                  + Adicionar conteúdo
                </button>
                <button onClick={copyInternalLink} className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors">
                  {copyFeedback ? "Copiado!" : "Copiar Link Interno"}
                </button>
                {allInternalApproved && (
                  <button onClick={handleSendClient} className="text-sm px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                    Enviar para Cliente
                  </button>
                )}
              </>
            )}

            {/* OPEN / CLOSED: original buttons */}
            {(campaign.status === "OPEN" || campaign.status === "CLOSED") && (
              <>
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
                <button onClick={() => setShowFolderUpload(true)} className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors">
                  + Adicionar conteúdo
                </button>
                <button onClick={handleResetApprovals} className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors">
                  Resetar Aprovações
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Marcar campanha como Publicada? Ela será movida para Concluídas no dashboard.")) return;
                    await fetch(`/api/admin/campaigns/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "PUBLISHED" }),
                    });
                    fetchCampaign();
                  }}
                  className="text-sm px-3 py-2 bg-teal-900/20 hover:bg-teal-900/30 text-teal-400 rounded-lg transition-colors"
                >
                  Marcar como Publicada
                </button>
              </>
            )}

            {/* PUBLISHED */}
            {campaign.status === "PUBLISHED" && (
              <button
                onClick={async () => {
                  await fetch(`/api/admin/campaigns/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "CLOSED" }),
                  });
                  fetchCampaign();
                }}
                className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors"
              >
                Reabrir
              </button>
            )}

            <button onClick={handleDeleteCampaign} className="text-sm px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors">
              Excluir
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

      {/* Internal review banner */}
      {(campaign.status === "INTERNAL_REVIEW" || campaign.status === "INTERNAL_DONE") && (
        <div className={`border rounded-xl px-5 py-4 space-y-3 ${
          campaign.status === "INTERNAL_DONE" && (internalAdjustment + internalRejected) > 0
            ? "bg-amber-900/20 border-amber-500/30"
            : campaign.status === "INTERNAL_DONE" && allInternalApproved
            ? "bg-emerald-900/20 border-emerald-500/30"
            : "bg-violet-900/20 border-violet-500/30"
        }`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className={`font-medium text-sm ${
                campaign.status === "INTERNAL_DONE" && (internalAdjustment + internalRejected) > 0
                  ? "text-amber-400"
                  : campaign.status === "INTERNAL_DONE" && allInternalApproved
                  ? "text-emerald-400"
                  : "text-violet-400"
              }`}>
                {campaign.status === "INTERNAL_REVIEW"
                  ? "Aguardando revisão interna"
                  : allInternalApproved
                  ? "Revisão interna concluída — tudo aprovado"
                  : "Revisão interna concluída — ajustes necessários"}
              </p>
              <p className="text-gray-400/70 text-xs mt-0.5">
                {campaign.status === "INTERNAL_REVIEW"
                  ? `${internalPending} ${internalPending === 1 ? "post pendente" : "posts pendentes"} de revisão`
                  : allInternalApproved
                  ? "Todos os posts aprovados. Você já pode enviar para o cliente."
                  : `${internalAdjustment + internalRejected} ${internalAdjustment + internalRejected === 1 ? "post precisa" : "posts precisam"} de correção antes de enviar ao cliente.`
                }
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400">{internalApproved} aprovados</span>
                {internalAdjustment > 0 && <span className="text-amber-400">{internalAdjustment} ajustes</span>}
                {internalRejected > 0 && <span className="text-red-400">{internalRejected} reprovados</span>}
                {internalPending > 0 && <span className="text-gray-400">{internalPending} pendentes</span>}
              </div>
              {campaign.status === "INTERNAL_DONE" && allInternalApproved && (
                <button onClick={handleSendClient} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
                  Enviar para Cliente
                </button>
              )}
              {campaign.status === "INTERNAL_DONE" && !allInternalApproved && (
                <button onClick={handleSendInternal} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
                  Reenviar para Revisão
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-xs shrink-0">Link interno:</span>
            <input readOnly value={internalReviewUrl} className="flex-1 bg-transparent text-xs text-gray-300 focus:outline-none" />
            <button onClick={copyInternalLink} className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded transition-colors shrink-0">
              {copyFeedback ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* Reopen banner — shown when campaign is CLOSED and has adjustments pending */}
      {campaign.status === "CLOSED" && (adjustment > 0 || rejected > 0) && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-amber-400 font-medium text-sm">Ajustes solicitados pelo cliente</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              {adjustment + rejected} {adjustment + rejected === 1 ? "post precisa" : "posts precisam"} de correção. Faça as alterações e envie para o cliente revisar novamente.
            </p>
          </div>
          <button
            onClick={handleReopen}
            className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            Enviar para aprovação
          </button>
        </div>
      )}

      {/* Approval URL — only shown when sent to client */}
      {(campaign.status === "OPEN" || campaign.status === "CLOSED") && (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-gray-400 text-sm shrink-0">Link do cliente:</span>
          <input readOnly value={approvalUrl} className="flex-1 bg-transparent text-sm text-gray-300 focus:outline-none" />
          <button onClick={copyLink} className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors shrink-0">
            {copyFeedback ? "Copiado!" : "Copiar"}
          </button>
        </div>
      )}

      {/* Folder Upload Modal */}
      {showFolderUpload && (
        <FolderUploadModal
          campaignId={id}
          existingItemCount={campaign.contentItems.length}
          onDone={() => { fetchCampaign(); }}
          onClose={() => setShowFolderUpload(false)}
        />
      )}


      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightboxUrl(null)} className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm">
              ✕ Fechar (Esc)
            </button>
            <img src={lightboxUrl} alt="" className="w-full rounded-xl object-contain max-h-[85vh]" />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-medium mb-4">Editar Post</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nome do post</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Ex: Post motivacional semana 1"
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Legenda</label>
                <textarea
                  value={editForm.caption}
                  onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                  rows={3}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Data de publicação</label>
                <input
                  type="date"
                  value={editForm.scheduledDate}
                  onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Link do Drive</label>
                <input
                  type="url"
                  value={editForm.driveUrl}
                  onChange={(e) => setEditForm({ ...editForm, driveUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                />
              </div>

              {editingGroup.groupId && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Adicionar slides ao carrossel <span className="text-gray-600">(opcional — links do Drive, um por linha)</span>
                  </label>
                  <textarea
                    value={newSlideLinks}
                    onChange={(e) => setNewSlideLinks(e.target.value)}
                    rows={3}
                    placeholder={"https://drive.google.com/file/d/ID1/view\nhttps://drive.google.com/file/d/ID2/view"}
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none placeholder-gray-600"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setEditingGroup(null); setNewSlideLinks(""); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={addingSlides}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm transition-colors font-medium"
                >
                  {addingSlides ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Content Items */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10">
          <h2 className="text-white font-medium text-sm">Conteúdos ({total} {total === 1 ? "post" : "posts"})</h2>
        </div>

        {total === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhum conteúdo adicionado ainda.</p>
            <button onClick={() => setShowFolderUpload(true)} className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
              Adicionar conteúdo via Drive →
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
                        <img
                          src={item.fileUrl}
                          alt=""
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => setLightboxUrl(item.fileUrl)}
                        />
                      ) : item.fileType === "VIDEO" ? (
                        <span className="text-2xl">🎬</span>
                      ) : (
                        <span className="text-2xl">📄</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.title && (
                        <p className="text-white text-sm font-medium mb-0.5">{item.title}</p>
                      )}
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
                      {item.driveUrl && (
                        <a href={item.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                          🔗 Ver no Drive
                        </a>
                      )}
                      {item.internalReviewItem?.comment && (
                        <div className="mt-1.5 text-xs text-violet-300 bg-violet-900/20 border border-violet-500/20 rounded-lg px-2.5 py-1.5">
                          <span className="text-violet-400/70">Revisão interna: </span>
                          {item.internalReviewItem.comment}
                        </div>
                      )}
                      {item.approvalItem?.clientComment && (
                        <div className="mt-1.5 text-xs text-gray-400 bg-white/5 rounded-lg px-2.5 py-1.5">
                          <span className="text-gray-500">Comentário do cliente: </span>
                          {item.approvalItem.clientComment}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {item.internalReviewItem && (
                        <>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.internalReviewItem.status === "APPROVED" ? "bg-emerald-900/30 text-emerald-400"
                            : item.internalReviewItem.status === "ADJUSTMENT" ? "bg-amber-900/30 text-amber-400"
                            : item.internalReviewItem.status === "REJECTED" ? "bg-red-900/30 text-red-400"
                            : "bg-violet-900/30 text-violet-400"
                          }`}>
                            {item.internalReviewItem.status === "APPROVED" ? "✅ Int. Aprovado"
                            : item.internalReviewItem.status === "ADJUSTMENT" ? "✏️ Int. Ajuste"
                            : item.internalReviewItem.status === "REJECTED" ? "❌ Int. Reprovado"
                            : "⏳ Int. Pendente"}
                          </span>
                          {(item.internalReviewItem.status === "ADJUSTMENT" || item.internalReviewItem.status === "REJECTED") && (
                            <button
                              onClick={() => handleResetInternalItem([item.id])}
                              className="text-xs px-2.5 py-1 bg-violet-900/40 hover:bg-violet-900/60 text-violet-400 border border-violet-500/30 rounded-lg transition-colors"
                            >
                              Ajuste feito
                            </button>
                          )}
                        </>
                      )}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${APPROVAL_STATUS_COLORS[statusKey]}`}>
                        {APPROVAL_STATUS_LABELS[statusKey]}
                      </span>
                      {(statusKey === "ADJUSTMENT" || statusKey === "REJECTED") && (
                        <button
                          onClick={() => handleMarkItemDone(item.id)}
                          disabled={markingDoneItemId === item.id}
                          className="text-xs px-2.5 py-1 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {markingDoneItemId === item.id ? "..." : "Ajuste feito"}
                        </button>
                      )}
                      <button onClick={() => openEditGroup([item])} className="text-gray-400 hover:text-white text-sm transition-colors">
                        Editar
                      </button>
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
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {firstItem.title && (
                        <span className="text-white text-sm font-medium">{firstItem.title}</span>
                      )}
                      <span className="text-xs font-medium text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                        Carrossel — {slides.length} slides
                      </span>
                      {firstItem.scheduledDate && (
                        <span className="text-xs text-gray-500">
                          {new Date(firstItem.scheduledDate).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {firstItem.internalReviewItem && (
                        <>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            firstItem.internalReviewItem.status === "APPROVED" ? "bg-emerald-900/30 text-emerald-400"
                            : firstItem.internalReviewItem.status === "ADJUSTMENT" ? "bg-amber-900/30 text-amber-400"
                            : firstItem.internalReviewItem.status === "REJECTED" ? "bg-red-900/30 text-red-400"
                            : "bg-violet-900/30 text-violet-400"
                          }`}>
                            {firstItem.internalReviewItem.status === "APPROVED" ? "✅ Int. Aprovado"
                            : firstItem.internalReviewItem.status === "ADJUSTMENT" ? "✏️ Int. Ajuste"
                            : firstItem.internalReviewItem.status === "REJECTED" ? "❌ Int. Reprovado"
                            : "⏳ Int. Pendente"}
                          </span>
                          {(firstItem.internalReviewItem.status === "ADJUSTMENT" || firstItem.internalReviewItem.status === "REJECTED") && (
                            <button
                              onClick={() => handleResetInternalItem(slides.map((s) => s.id))}
                              className="text-xs px-2.5 py-1 bg-violet-900/40 hover:bg-violet-900/60 text-violet-400 border border-violet-500/30 rounded-lg transition-colors"
                            >
                              Ajuste feito
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteGroup(slides)}
                      className="text-xs px-2.5 py-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors shrink-0"
                    >
                      Excluir post
                    </button>
                  </div>
                  {firstItem.internalReviewItem?.comment && (
                    <div className="mb-2 text-xs text-violet-300 bg-violet-900/20 border border-violet-500/20 rounded-lg px-2.5 py-1.5">
                      <span className="text-violet-400/70">Revisão interna: </span>
                      {firstItem.internalReviewItem.comment}
                    </div>
                  )}
                  <CarouselCard
                    campaignId={id}
                    slides={slides}
                    title={firstItem.title}
                    caption={firstItem.caption}
                    scheduledDate={firstItem.scheduledDate}
                    driveUrl={firstItem.driveUrl}
                    clientComment={slides[0].approvalItem?.clientComment || null}
                    onDelete={handleDeleteItem}
                    onEdit={() => openEditGroup(slides)}
                    onReorder={() => {}}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
