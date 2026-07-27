"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CONTENT_TYPE_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from "@/types";
import type { ContentType, ApprovalStatus } from "@/types";
import FolderUploadModal from "@/components/admin/FolderUploadModal";
import RoteiroClientLink from "@/components/admin/RoteiroClientLink";

type PostStageStatus = "DRAFT" | "INTERNAL_REVIEW" | "INTERNAL_DONE" | "CLIENT_REVIEW" | "APPROVED" | "PUBLISHED";

interface ApprovalItem {
  status: ApprovalStatus;
  clientComment: string | null;
}

interface InternalReviewItem {
  status: ApprovalStatus;
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
  status: PostStageStatus;
  sentToProgramacaoAt: string | null;
  approvalItem: ApprovalItem | null;
  internalReviewItem: InternalReviewItem | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  token: string;
  internalToken: string;
  roteiroClienteId: string | null;
  contentItems: ContentItem[];
}

interface GroupedPost {
  items: ContentItem[];
  rep: ContentItem;
  isCarousel: boolean;
}

const STATUS_SECTIONS: { key: PostStageStatus; label: string }[] = [
  { key: "DRAFT", label: "Rascunho" },
  { key: "INTERNAL_REVIEW", label: "Revisão interna" },
  { key: "CLIENT_REVIEW", label: "Aguardando cliente" },
  { key: "APPROVED", label: "Aprovado" },
  { key: "PUBLISHED", label: "Publicado" },
];

const REVIEW_STATUS_BADGE: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: "⏳ Pendente", color: "bg-violet-900/30 text-violet-400" },
  APPROVED: { label: "✅ Aprovado", color: "bg-emerald-900/30 text-emerald-400" },
  ADJUSTMENT: { label: "✏️ Ajuste", color: "bg-amber-900/30 text-amber-400" },
  REJECTED: { label: "❌ Reprovado", color: "bg-red-900/30 text-red-400" },
};

function buildGroups(items: ContentItem[]): GroupedPost[] {
  const groups: GroupedPost[] = [];
  const seenGroupIds = new Set<string>();

  for (const item of items) {
    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seenGroupIds.has(item.groupId)) continue;
      seenGroupIds.add(item.groupId);
      const slides = items
        .filter((c) => c.groupId === item.groupId)
        .sort((a, b) => a.order - b.order);
      groups.push({ items: slides, rep: slides[0], isCarousel: true });
    } else {
      groups.push({ items: [item], rep: item, isCarousel: false });
    }
  }

  return groups;
}

export default function ClientWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const [showFolderUpload, setShowFolderUpload] = useState(false);
  const [copiedWhich, setCopiedWhich] = useState<"client" | "internal" | "message" | null>(null);
  const [copiedLinkItemId, setCopiedLinkItemId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [editingPost, setEditingPost] = useState<GroupedPost | null>(null);
  const [editForm, setEditForm] = useState({ title: "", caption: "", scheduledDate: "", driveUrl: "", coverDriveUrl: "", contentType: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClient(data);
    } catch {
      // keep current state on refresh failure
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  useEffect(() => {
    const interval = setInterval(() => fetchClient(), 60000);
    return () => clearInterval(interval);
  }, [fetchClient]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function copyClientLink() {
    if (!client) return;
    navigator.clipboard.writeText(`${window.location.origin}/aprovar/${client.token}`);
    setCopiedWhich("client");
    setTimeout(() => setCopiedWhich(null), 2000);
  }

  function copyInternalLink() {
    if (!client) return;
    navigator.clipboard.writeText(`${window.location.origin}/revisar/${client.internalToken}`);
    setCopiedWhich("internal");
    setTimeout(() => setCopiedWhich(null), 2000);
  }

  async function notifyClient() {
    setNotifying(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}/notify`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const canais = [data.sent?.whatsapp && "WhatsApp", data.sent?.email && "e-mail"].filter(Boolean);
      alert(canais.length ? `Cliente notificado por ${canais.join(" e ")} (${data.pending} para aprovar).` : "Cliente não tem WhatsApp/e-mail cadastrado.");
    } catch {
      alert("Erro ao notificar o cliente. Tente novamente.");
    } finally {
      setNotifying(false);
    }
  }

  function copyClientMessage() {
    if (!client) return;
    // Conta posts aguardando o cliente (carrossel = 1 post)
    const seen = new Set<string>();
    let n = 0;
    for (const it of client.contentItems) {
      if (it.status !== "CLIENT_REVIEW") continue;
      const key = it.contentType === "CARROSSEL" && it.groupId ? it.groupId : it.id;
      if (seen.has(key)) continue;
      seen.add(key);
      n++;
    }
    const nLabel = n === 1 ? "1 post" : `${n} posts`;
    const url = `${window.location.origin}/aprovar/${client.token}`;
    const msg =
      `Olá! 👋 O conteúdo de vocês está pronto para aprovação.\n\n` +
      `Você tem *${nLabel}* aguardando revisão. É só acessar o link abaixo, olhar cada post e *aprovar* ✅ ou *pedir ajuste* ✏️ (com um comentário do que mudar):\n\n` +
      `${url}\n\n` +
      `Assim que aprovar, já entra na nossa programação. Qualquer dúvida, é só chamar aqui. 🙌`;
    navigator.clipboard.writeText(msg);
    setCopiedWhich("message");
    setTimeout(() => setCopiedWhich(null), 2000);
  }

  function copyDesignerLink(itemId: string) {
    navigator.clipboard.writeText(`${window.location.origin}/post/${itemId}`);
    setCopiedLinkItemId(itemId);
    setTimeout(() => setCopiedLinkItemId(null), 2000);
  }

  async function handleAction(repId: string, action: "send-internal" | "send-client" | "mark-published") {
    setBusyId(repId);
    try {
      const res = await fetch(`/api/admin/posts/${repId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      await fetchClient();
    } catch {
      alert("Erro ao mover o post. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleProgramacao(repId: string, next: boolean) {
    setBusyId(repId);
    try {
      const res = await fetch(`/api/admin/posts/${repId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentToProgramacao: next }),
      });
      if (!res.ok) throw new Error();
      await fetchClient();
    } catch {
      alert("Erro ao atualizar a programação. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(group: GroupedPost) {
    const count = group.items.length;
    if (!confirm(`Excluir este post${count > 1 ? ` (${count} slides)` : ""}? Esta ação não pode ser desfeita.`)) return;
    setBusyId(group.rep.id);
    try {
      const res = await fetch(`/api/admin/posts/${group.rep.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchClient();
    } catch {
      alert("Erro ao excluir. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(group: GroupedPost) {
    setEditingPost(group);
    setEditForm({
      title: group.rep.title || "",
      caption: group.rep.caption || "",
      scheduledDate: group.rep.scheduledDate ? group.rep.scheduledDate.split("T")[0] : "",
      driveUrl: group.rep.driveUrl || "",
      coverDriveUrl: group.rep.coverDriveUrl || "",
      contentType: group.rep.contentType,
    });
  }

  async function handleEditSave() {
    if (!editingPost) return;
    setSavingEdit(true);

    let coverUrl: string | null = null;
    if (editForm.coverDriveUrl.trim()) {
      const m = editForm.coverDriveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m) coverUrl = `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
    }

    try {
      for (const item of editingPost.items) {
        const res = await fetch(`/api/admin/posts/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title || null,
            caption: editForm.caption || null,
            scheduledDate: editForm.scheduledDate || null,
            driveUrl: editForm.driveUrl || null,
            // Tipo só é editável em post único (carrossel mantém o tipo do grupo)
            ...(editingPost.rep.contentType !== "CARROSSEL" && editForm.contentType && {
              contentType: editForm.contentType,
            }),
            ...(editForm.coverDriveUrl.trim() !== "" && {
              coverUrl,
              coverDriveUrl: editForm.coverDriveUrl.trim() || null,
            }),
          }),
        });
        if (!res.ok) throw new Error("Erro ao salvar post.");
      }

      setEditingPost(null);
      await fetchClient();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) return <div className="text-gray-400 p-8">Carregando...</div>;
  if (!client) return <div className="text-red-400 p-8">Cliente não encontrado.</div>;

  const groups = buildGroups(client.contentItems);
  const sections = STATUS_SECTIONS.map((section) => ({
    ...section,
    groups: groups.filter((g) => g.rep.status === section.key),
  })).filter((section) => section.groups.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/admin/clients" className="hover:text-white transition-colors">
              Clientes
            </Link>
            <span>/</span>
            <span className="text-white">{client.name}</span>
          </div>
          <h1 className="text-xl font-semibold text-white">{client.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400 flex-wrap">
            <span>{client.email}</span>
            {client.whatsapp && (
              <>
                <span className="text-gray-600">·</span>
                <span>{client.whatsapp}</span>
              </>
            )}
          </div>
          <div className="mt-3 max-w-md">
            <RoteiroClientLink clientId={client.id} clientName={client.name} current={client.roteiroClienteId} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFolderUpload(true)}
            className="text-sm px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            + Adicionar posts
          </button>
          <button
            onClick={copyClientMessage}
            className="text-sm px-3 py-2 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors"
          >
            {copiedWhich === "message" ? "Copiado!" : "💬 Copiar mensagem p/ cliente"}
          </button>
          <button
            onClick={copyClientLink}
            className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
          >
            {copiedWhich === "client" ? "Copiado!" : "Copiar link do cliente"}
          </button>
          <button
            onClick={notifyClient}
            disabled={notifying}
            className="text-sm px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {notifying ? "Enviando..." : "📨 Notificar cliente"}
          </button>
          <button
            onClick={copyInternalLink}
            className="text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
          >
            {copiedWhich === "internal" ? "Copiado!" : "Copiar link revisão interna"}
          </button>
        </div>
      </div>

      {/* Folder Upload Modal */}
      {showFolderUpload && (
        <FolderUploadModal
          clientId={id}
          existingItemCount={client.contentItems.length}
          onDone={() => { fetchClient(); }}
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
      {editingPost && (
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
              {(["POST_FEED", "REELS", "STORIES"] as string[]).includes(editingPost.rep.contentType) && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Tipo</label>
                  <select
                    value={editForm.contentType}
                    onChange={(e) => setEditForm({ ...editForm, contentType: e.target.value })}
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="POST_FEED">Post Feed</option>
                    <option value="REELS">Reels</option>
                    <option value="STORIES">Stories</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Legenda</label>
                <textarea
                  value={editForm.caption}
                  onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                  rows={6}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-y min-h-[6rem] max-h-[60vh]"
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

              {(editingPost.rep.fileType === "VIDEO" || editingPost.rep.contentType === "REELS") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Capa do vídeo
                    <span className="text-gray-600 ml-1">(link do Drive)</span>
                  </label>
                  <input
                    type="url"
                    value={editForm.coverDriveUrl}
                    onChange={(e) => setEditForm({ ...editForm, coverDriveUrl: e.target.value })}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                  />
                  {editForm.coverDriveUrl.trim() && !editForm.coverDriveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) && (
                    <p className="text-xs text-red-400 mt-1">Link do Drive não reconhecido</p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditingPost(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={savingEdit}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm transition-colors font-medium"
                >
                  {savingEdit ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts by status */}
      {client.contentItems.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">Nenhum post adicionado ainda.</p>
          <button onClick={() => setShowFolderUpload(true)} className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
            Adicionar posts via Drive →
          </button>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.key} className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10">
              <h2 className="text-white font-medium text-sm">
                {section.label} ({section.groups.length})
              </h2>
            </div>
            <div className="flex flex-col gap-3 p-3">
              {section.groups.map((group) => {
                const rep = group.rep;
                const isBusy = busyId === rep.id;

                return (
                  <div key={rep.id} className="bg-black/20 border border-white/[0.08] rounded-xl overflow-hidden">
                    <div className="flex items-start gap-4 px-5 py-4">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center relative">
                        {rep.fileType === "IMAGE" ? (
                          <img
                            src={rep.fileUrl}
                            alt=""
                            className="w-full h-full object-cover cursor-zoom-in"
                            onClick={() => setLightboxUrl(rep.fileUrl)}
                          />
                        ) : rep.fileType === "VIDEO" ? (
                          <span className="text-2xl">🎬</span>
                        ) : rep.fileType === "DOCUMENT" ? (
                          <span className="text-2xl">📝</span>
                        ) : (
                          <span className="text-2xl">📄</span>
                        )}
                        {group.isCarousel && (
                          <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">
                            {group.items.length}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {rep.title && <p className="text-white text-sm font-medium mb-0.5">{rep.title}</p>}
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                            {CONTENT_TYPE_LABELS[rep.contentType]}
                          </span>
                          {group.isCarousel && (
                            <span className="text-xs font-medium text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                              Carrossel — {group.items.length} slides
                            </span>
                          )}
                          {rep.scheduledDate && (
                            <span className="text-xs text-gray-500">
                              {new Date(rep.scheduledDate).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                        {rep.caption && <p className="text-sm text-gray-300 line-clamp-2">{rep.caption}</p>}
                        {rep.driveUrl && (
                          <a href={rep.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            🔗 Ver no Drive
                          </a>
                        )}
                        {rep.internalReviewItem?.comment && (
                          <div className="mt-1.5 text-xs rounded-lg px-2.5 py-1.5 text-violet-300 bg-violet-900/20 border border-violet-500/20">
                            <span className="opacity-70">Revisão interna: </span>
                            {rep.internalReviewItem.comment}
                          </div>
                        )}
                        {rep.approvalItem?.clientComment && (
                          <div className="mt-1.5 text-xs rounded-lg px-2.5 py-1.5 text-amber-400 bg-amber-900/20">
                            <span className="opacity-70">Comentário do cliente: </span>
                            {rep.approvalItem.clientComment}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-xs">
                        <button
                          onClick={() => copyDesignerLink(rep.id)}
                          className="text-xs px-2.5 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                        >
                          {copiedLinkItemId === rep.id ? "Copiado!" : "🔗 Link p/ designer"}
                        </button>

                        {rep.internalReviewItem && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${REVIEW_STATUS_BADGE[rep.internalReviewItem.status].color}`}>
                            {REVIEW_STATUS_BADGE[rep.internalReviewItem.status].label} (interno)
                          </span>
                        )}
                        {rep.approvalItem && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${APPROVAL_STATUS_COLORS[rep.approvalItem.status]}`}>
                            {APPROVAL_STATUS_LABELS[rep.approvalItem.status]}
                          </span>
                        )}

                        {rep.status === "DRAFT" && (
                          <button
                            onClick={() => handleAction(rep.id, "send-internal")}
                            disabled={isBusy}
                            className="text-xs px-2.5 py-1 bg-violet-900/40 hover:bg-violet-900/60 text-violet-400 border border-violet-500/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isBusy ? "..." : "Enviar p/ revisão interna"}
                          </button>
                        )}

                        {rep.status === "INTERNAL_REVIEW" && (rep.internalReviewItem?.status === "ADJUSTMENT" || rep.internalReviewItem?.status === "REJECTED") && (
                          <button
                            onClick={() => handleAction(rep.id, "send-internal")}
                            disabled={isBusy}
                            className="text-xs px-2.5 py-1 bg-violet-900/40 hover:bg-violet-900/60 text-violet-400 border border-violet-500/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isBusy ? "..." : "Ajuste feito"}
                          </button>
                        )}

                        {rep.status === "CLIENT_REVIEW" && (rep.approvalItem?.status === "ADJUSTMENT" || rep.approvalItem?.status === "REJECTED") && (
                          <button
                            onClick={() => handleAction(rep.id, "send-client")}
                            disabled={isBusy}
                            className="text-xs px-2.5 py-1 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isBusy ? "..." : "Ajuste feito"}
                          </button>
                        )}

                        {rep.status === "APPROVED" && (
                          rep.sentToProgramacaoAt ? (
                            <>
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-900/30 text-sky-400">
                                ✓ Na Programação
                              </span>
                              <button
                                onClick={() => handleToggleProgramacao(rep.id, false)}
                                disabled={isBusy}
                                className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {isBusy ? "..." : "Remover da Programação"}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleToggleProgramacao(rep.id, true)}
                              disabled={isBusy}
                              className="text-xs px-2.5 py-1 bg-sky-900/40 hover:bg-sky-900/60 text-sky-400 border border-sky-500/30 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isBusy ? "..." : "→ Programação"}
                            </button>
                          )
                        )}
                        {rep.status === "APPROVED" && (
                          <button
                            onClick={() => handleAction(rep.id, "mark-published")}
                            disabled={isBusy}
                            className="text-xs px-2.5 py-1 bg-teal-900/40 hover:bg-teal-900/60 text-teal-400 border border-teal-500/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isBusy ? "..." : "Marcar publicado"}
                          </button>
                        )}

                        {rep.status === "PUBLISHED" && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-900/30 text-teal-400">
                            ✅ Publicado
                          </span>
                        )}

                        {rep.status !== "PUBLISHED" && (
                          <button onClick={() => openEdit(group)} className="text-gray-400 hover:text-white text-sm transition-colors">
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(group)}
                          disabled={isBusy}
                          className="text-red-500 hover:text-red-400 text-sm transition-colors disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
