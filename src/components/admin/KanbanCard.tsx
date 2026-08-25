"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PostActionsMenu from "@/components/admin/PostActionsMenu";
import PostThumbnail from "@/components/admin/PostThumbnail";
import { buildAprovacaoMsg } from "@/lib/aprovacaoMsg";
import { driveAssetsFromLink, extractDriveId, driveThumbUrl } from "@/lib/drive";
import PostNameEditor from "@/components/admin/PostNameEditor";
import PostDatePicker from "@/components/admin/PostDatePicker";
import CopyProgLinkButton from "@/components/admin/CopyProgLinkButton";

export interface KanbanCardData {
  id: string;
  title: string | null;
  caption: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  clientId: string;
  clientName: string;
  clientToken?: string | null;
  clientInternalToken?: string | null;
  clientCoverToken?: string | null;
  driveUrl?: string | null;
  scheduledLabel?: string | null;
  scheduledInput?: string | null;
  daysWaiting?: number | null;
  roteiroAttached?: boolean;
  asanaUrl?: string | null;
  adjustmentSource?: "cliente" | "interno" | null;
  adjustmentComment?: string | null;
  coverRedoNote?: string | null;
}

function postLabel(p: { title: string | null; caption: string | null }): string {
  if (p.title && p.title.trim()) return p.title;
  if (p.caption && p.caption.trim()) {
    const s = p.caption.trim().replace(/\s+/g, " ");
    return s.length > 50 ? s.slice(0, 50) + "…" : s;
  }
  return "(sem título)";
}

/** Previsão vencida ou a ≤1 dia (hoje/amanhã/passado) → urgência (vermelho). ymd = "YYYY-MM-DD". */
function isPrevisaoUrgent(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000) <= 1;
}

export default function KanbanCard({
  post,
  stageId,
  draggable,
  designerToken,
}: {
  post: KanbanCardData;
  stageId?: string;
  draggable?: boolean;
  designerToken?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [coverLink, setCoverLink] = useState("");

  // Assets do novo link (se informado e válido) e mensagem exibida no popup.
  const newAssets = driveLink.trim() ? driveAssetsFromLink(driveLink.trim(), post.fileType) : null;
  const linkInvalido = driveLink.trim().length > 0 && !newAssets;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const internalUrl = post.clientInternalToken ? `${origin}/revisar/${post.clientInternalToken}` : null;
  const modalMsg = buildAprovacaoMsg({
    title: post.title,
    clientName: post.clientName,
    asanaUrl: post.asanaUrl,
    connected: !!post.roteiroAttached,
    internalUrl,
    adjustment: post.adjustmentComment,
  });

  async function patchPost(body: Record<string, unknown>, errMsg: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      return true;
    } catch {
      alert(errMsg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function conclude(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await patchPost({ action: "mark-published" }, "Erro ao concluir o post. Tente novamente.");
  }

  // "Criar capa": salva o link da capa (→ move para "Aprovar capa") e ENVIA a capa
  // pelo bot para o grupo de aprovação (com o link de aprovar a capa).
  async function enviarCapa(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const link = coverLink.trim();
    const id = extractDriveId(link);
    if (!id) { alert("Cole um link válido da capa no Google Drive."); return; }
    if (busy) return;
    setBusy(true);
    try {
      // Salva a capa → post vai para "Aprovar capa"; o aviso ao grupo de aprovações
      // é disparado automaticamente pelo servidor (coverJustAdded).
      const r1 = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverDriveUrl: link, coverUrl: driveThumbUrl(id) }),
      });
      if (!r1.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Erro ao enviar a capa para aprovação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDriveLink("");
    setCopied(false);
    setShowModal(true);
  }

  function copyModalMsg() {
    navigator.clipboard.writeText(modalMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function confirmAjuste() {
    if (linkInvalido) {
      alert("Link do Drive inválido. Cole um link de arquivo ou pasta do Google Drive.");
      return;
    }
    navigator.clipboard.writeText(modalMsg);
    const ok = await patchPost(
      { ...(newAssets ?? {}), action: "adjustment-done" },
      "Erro ao reenviar. Tente novamente."
    );
    if (ok) { setShowModal(false); setDriveLink(""); }
  }

  return (
    <div className="relative">
      <Link
        href={`/admin/clients/${post.clientId}`}
        draggable={draggable}
        onDragStart={
          draggable
            ? (e) => {
                e.dataTransfer.setData("text/plain", post.id);
                e.dataTransfer.effectAllowed = "move";
              }
            : undefined
        }
        className={`block rounded-lg p-2 border transition-colors ${
          stageId === "scheduled"
            ? "bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400/60"
            : "bg-[#0f0f0f] border-white/[0.06] hover:border-white/20"
        } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${busy ? "opacity-50" : ""}`}
      >
        <div className="flex items-center gap-2 pr-6">
          <PostThumbnail fileType={post.fileType} fileUrl={post.fileUrl} driveUrl={post.driveUrl} label={postLabel(post)} />
          <div className="min-w-0 flex-1">
            <PostNameEditor postId={post.id} title={post.title} fallbackLabel={postLabel(post)} textClassName="text-white text-[11px] font-medium" />
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-gray-500 truncate min-w-0">{post.clientName}</p>
              {post.roteiroAttached && (
                <span className="text-[9px] text-fuchsia-300 bg-fuchsia-900/30 border border-fuchsia-500/30 px-1 py-0.5 rounded shrink-0" title="Roteiro anexado ao Roteirização">🔗 Roteiro</span>
              )}
            </div>
            {post.scheduledLabel ? (
              <p className={`text-[10px] ${post.scheduledInput && isPrevisaoUrgent(post.scheduledInput) ? "text-red-400 font-semibold" : "text-gray-500"}`}>
                🔮 Previsão: {post.scheduledLabel}
              </p>
            ) : (
              <p className="text-[10px] text-gray-600 italic">Sem previsão de postagem</p>
            )}
          </div>
        </div>
        {stageId === "readyToSchedule" && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PostDatePicker postId={post.id} value={post.scheduledInput ?? null} label={post.scheduledLabel ?? null} />
            <CopyProgLinkButton clientId={post.clientId} />
            {post.daysWaiting != null && post.daysWaiting > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-auto ${
                  post.daysWaiting >= 7
                    ? "bg-red-900/30 text-red-400"
                    : post.daysWaiting >= 3
                    ? "bg-amber-900/30 text-amber-400"
                    : "bg-yellow-900/20 text-yellow-500"
                }`}
              >
                {post.daysWaiting}d
              </span>
            )}
          </div>
        )}
        {stageId === "scheduled" && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PostDatePicker postId={post.id} value={post.scheduledInput ?? null} label={post.scheduledLabel ?? null} done />
            <CopyProgLinkButton clientId={post.clientId} />
            <button
              type="button"
              onClick={conclude}
              disabled={busy}
              className="text-[10px] px-2 py-0.5 rounded bg-teal-900/40 hover:bg-teal-900/60 text-teal-300 border border-teal-500/30 shrink-0 disabled:opacity-50 transition-colors ml-auto"
            >
              ✓ Concluído
            </button>
          </div>
        )}
        {stageId === "criarCapa" && (
          <div className="mt-1.5 space-y-1.5" onClick={(e) => e.preventDefault()}>
            {post.coverRedoNote && (
              <div className="text-[10px] text-amber-400 bg-amber-900/20 border border-amber-500/20 rounded px-2 py-1 whitespace-pre-wrap">
                ↩️ Refazer capa: {post.coverRedoNote}
              </div>
            )}
            <input
              type="text"
              value={coverLink}
              onChange={(e) => setCoverLink(e.target.value)}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              placeholder="Link da capa no Drive"
              className="w-full bg-[#0f0f0f] border border-white/15 rounded px-2 py-1 text-white text-[10px] outline-none focus:border-fuchsia-500 placeholder-gray-600"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={enviarCapa}
                disabled={busy || !coverLink.trim()}
                className="text-[10px] px-2 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium disabled:opacity-40 transition-colors"
                title="Salva a capa e envia pelo bot para o grupo de aprovação de capa"
              >
                {busy ? "Enviando…" : "📤 Enviar capa para aprovação"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm("Programar este vídeo SEM capa? Ele sai de 'Criar capa' e vai para 'Prontos p/ programar'.")) {
                    patchPost({ coverWaived: true }, "Erro ao mover. Tente novamente.");
                  }
                }}
                disabled={busy}
                className="text-[10px] px-2 py-1 rounded bg-sky-900/40 hover:bg-sky-900/60 text-sky-300 border border-sky-500/30 disabled:opacity-50 transition-colors"
                title="Dispensa a capa e envia para Prontos p/ programar"
              >
                📅 Programar sem capa
              </button>
            </div>
          </div>
        )}
        {stageId === "aprovarCapa" && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap" onClick={(e) => e.preventDefault()}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                patchPost({ action: "approve-cover" }, "Erro ao aprovar. Tente novamente.");
              }}
              disabled={busy}
              className="text-[10px] px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 disabled:opacity-50 transition-colors"
              title="Aprova a capa e envia para Prontos p/ programar"
            >
              ✅ Aprovar capa
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const nota = window.prompt("Observações para o designer refazer a capa (o que mudar):", "");
                if (nota === null) return; // cancelou
                patchPost({ action: "redo-cover", coverRedoNote: nota }, "Erro ao mover. Tente novamente.");
              }}
              disabled={busy}
              className="text-[10px] px-2 py-1 rounded bg-amber-900/40 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 disabled:opacity-50 transition-colors"
              title="Remove a capa e volta para Criar capa"
            >
              ↩️ Refazer capa
            </button>
            {post.clientCoverToken && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigator.clipboard.writeText(`${origin}/capa/${post.clientCoverToken}`);
                  alert("Link de aprovação da capa copiado!");
                }}
                className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/15 transition-colors"
                title="Copiar link de aprovação da capa"
              >
                🔗 Link da capa
              </button>
            )}
          </div>
        )}
        {post.adjustmentComment && (
          <p className="text-[10px] text-amber-400 mt-1 line-clamp-2">
            ✏️ {post.adjustmentSource === "cliente" ? "Cliente" : "Interno"}: {post.adjustmentComment}
          </p>
        )}
        {post.adjustmentSource && (
          <div className="mt-1.5" onClick={(e) => e.preventDefault()}>
            <button
              type="button"
              onClick={openModal}
              disabled={busy}
              className="text-[10px] px-2 py-1 rounded bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 border border-violet-500/30 disabled:opacity-50 transition-colors"
              title="Abre o popup para revisar a mensagem, colar o novo link e reenviar"
            >
              ✅ Ajuste feito / Link Drive novo
            </button>
          </div>
        )}
      </Link>

      {/* Menu de ações no canto do card */}
      <div className="absolute top-1 right-1 z-10">
        <PostActionsMenu
          postId={post.id}
          clientId={post.clientId}
          clientToken={post.clientToken}
          internalMsg={modalMsg}
          needsAdjustment={!!post.adjustmentSource}
          canReopenAdjustment={stageId === "internal" || stageId === "clientReview"}
          designerToken={designerToken}
          onBusyChange={setBusy}
        />
      </div>

      {/* Popup do "Ajuste feito" */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => { e.stopPropagation(); setShowModal(false); }}
        >
          <div
            className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-md p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Ajuste feito → revisão interna</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Novo link do Drive (opcional)</label>
              <input
                type="text"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="Cole o link do Drive do post ajustado"
                className={`w-full bg-[#0f0f0f] border rounded-lg px-3 py-2 text-white text-xs outline-none placeholder-gray-600 ${linkInvalido ? "border-red-500/60" : "border-white/15 focus:border-blue-500"}`}
              />
              {linkInvalido && <p className="text-[11px] text-red-400 mt-1">Link do Drive inválido.</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-500">Mensagem para o grupo</label>
                <button onClick={copyModalMsg} className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200">
                  {copied ? "Copiado ✓" : "📋 Copiar"}
                </button>
              </div>
              <pre className="text-gray-300 text-[11px] whitespace-pre-wrap break-words bg-[#0f0f0f] border border-white/10 rounded-lg p-3 max-h-52 overflow-y-auto font-sans">{modalMsg}</pre>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                disabled={busy}
                className="flex-1 py-2 rounded-lg text-sm bg-white/5 text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAjuste}
                disabled={busy || linkInvalido}
                className="flex-1 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-50"
              >
                {busy ? "..." : "Confirmar e copiar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
