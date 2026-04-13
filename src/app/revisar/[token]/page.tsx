"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CONTENT_TYPE_LABELS } from "@/types";
import type { ContentType } from "@/types";

type Status = "PENDING" | "APPROVED" | "ADJUSTMENT" | "REJECTED";

interface InternalReviewItem {
  status: Status;
  comment: string | null;
}

interface ContentItem {
  id: string;
  fileUrl: string;
  fileType: string;
  caption: string | null;
  scheduledDate: string | null;
  contentType: ContentType;
  groupId: string | null;
  coverUrl: string | null;
  internalReviewItem: InternalReviewItem | null;
}

interface Campaign {
  id: string;
  name: string;
  token: string;
  internalToken: string;
  status: string;
  expiresAt: string;
  client: { name: string };
  contentItems: ContentItem[];
}

type LocalReview = { status: Status; comment: string };

type Group =
  | { type: "single"; item: ContentItem; groupKey: string }
  | { type: "carousel"; items: ContentItem[]; groupKey: string };

function buildGroups(items: ContentItem[]): Group[] {
  const groups: Group[] = [];
  const seenGroups = new Set<string>();
  for (const item of items) {
    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seenGroups.has(item.groupId)) continue;
      seenGroups.add(item.groupId);
      const slides = items.filter((i) => i.groupId === item.groupId);
      groups.push({ type: "carousel", items: slides, groupKey: item.groupId });
    } else {
      groups.push({ type: "single", item, groupKey: item.id });
    }
  }
  return groups;
}

export default function InternalReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState<Record<string, LocalReview>>({});
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [carouselSlide, setCarouselSlide] = useState<Record<string, number>>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ approved: number; adjustment: number; rejected: number } | null>(null);

  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/internal/${token}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const data: Campaign = await res.json();
    setCampaign(data);
    const built = buildGroups(data.contentItems);
    setGroups(built);
    const initial: Record<string, LocalReview> = {};
    for (const g of built) {
      const firstItem = g.type === "single" ? g.item : g.items[0];
      if (firstItem.internalReviewItem && firstItem.internalReviewItem.status !== "PENDING") {
        initial[g.groupKey] = {
          status: firstItem.internalReviewItem.status,
          comment: firstItem.internalReviewItem.comment || "",
        };
      }
    }
    setReviews(initial);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  async function saveGroupReview(groupKey: string, review: LocalReview, groupItems: ContentItem[]) {
    setSavingGroup(groupKey);
    for (const item of groupItems) {
      await fetch(`/api/internal/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentItemId: item.id,
          status: review.status,
          comment: review.comment || null,
        }),
      });
    }
    setSavingGroup(null);
  }

  async function setGroupStatus(groupKey: string, status: Status, items: ContentItem[]) {
    const newReview: LocalReview = { status, comment: reviews[groupKey]?.comment || "" };
    setReviews((prev) => ({ ...prev, [groupKey]: newReview }));
    if (status === "ADJUSTMENT" || status === "REJECTED") {
      setActiveGroup(groupKey);
      return;
    }
    await saveGroupReview(groupKey, newReview, items);
  }

  async function handleCommentSave(groupKey: string, items: ContentItem[]) {
    const review = reviews[groupKey];
    if (!review) return;
    if (!review.comment.trim()) {
      alert("Por favor, descreva o que precisa ser ajustado.");
      return;
    }
    await saveGroupReview(groupKey, review, items);
    setActiveGroup(null);
  }

  // Split: already approved (from DB) vs needs review
  const alreadyApprovedGroups = groups.filter((g) => {
    const firstItem = g.type === "single" ? g.item : g.items[0];
    return firstItem.internalReviewItem?.status === "APPROVED";
  });
  const needsReviewGroups = groups.filter((g) => {
    const firstItem = g.type === "single" ? g.item : g.items[0];
    return firstItem.internalReviewItem?.status !== "APPROVED";
  });

  async function handleSubmit() {
    const allDone = needsReviewGroups.every((g) => {
      const r = reviews[g.groupKey];
      return r && r.status !== "PENDING";
    });
    if (!allDone) { alert("Por favor, revise todos os itens antes de enviar."); return; }
    setSubmitting(true);
    const res = await fetch(`/api/internal/${token}/submit`, { method: "POST" });
    const data = await res.json();
    if (res.ok) { setSubmitted(true); setSubmitResult(data); }
    else alert(data.error || "Erro ao enviar revisão.");
    setSubmitting(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-gray-400">Carregando...</p>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold text-white mb-2">Link Inválido</h1>
        <p className="text-gray-400 text-sm">Este link de revisão não existe.</p>
        <p className="text-gray-600 text-xs mt-6">BRJ Mídias · Revisão Interna</p>
      </div>
    </div>
  );

  if (submitted && submitResult && campaign) {
    const allApproved = submitResult.adjustment === 0 && submitResult.rejected === 0 && submitResult.approved > 0;
    const approvalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/aprovar/${campaign.token}`;
    const prazo = new Date(campaign.expiresAt).toLocaleDateString("pt-BR");
    const whatsappMsg = `Olá, ${campaign.client.name}! 👋\n\nSeu conteúdo de *${campaign.name}* está pronto para aprovação.\n\nAcesse o link abaixo, revise cada post e aprove ou solicite ajustes:\n${approvalUrl}\n\n_Prazo de aprovação: ${prazo}_`;

    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="text-5xl mb-4">{allApproved ? "🚀" : "✅"}</div>
            <h1 className="text-xl font-semibold text-white mb-2">Revisão Interna Concluída!</h1>
            <p className="text-gray-400 text-sm">
              {allApproved ? "Tudo aprovado! Já pode enviar para o cliente." : "Revisão enviada. Aguarde os ajustes."}
            </p>
          </div>

          <div className="bg-[#1a1a24] border border-white/10 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Aprovados</span><span className="text-emerald-400 font-medium">{submitResult.approved}</span>
            </div>
            {submitResult.adjustment > 0 && (
              <div className="flex justify-between text-gray-300">
                <span>Com ajuste</span><span className="text-amber-400 font-medium">{submitResult.adjustment}</span>
              </div>
            )}
            {submitResult.rejected > 0 && (
              <div className="flex justify-between text-gray-300">
                <span>Reprovados</span><span className="text-red-400 font-medium">{submitResult.rejected}</span>
              </div>
            )}
          </div>

          {allApproved && (
            <div className="bg-[#1a1a24] border border-emerald-500/20 rounded-xl p-4 space-y-3">
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Mensagem para o cliente</p>
              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-3">
                {whatsappMsg}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(whatsappMsg);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                {copied ? "✅ Copiado!" : "📋 Copiar mensagem"}
              </button>
            </div>
          )}

          <p className="text-center text-gray-600 text-xs">BRJ Mídias · Revisão Interna</p>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const reviewedCount = needsReviewGroups.filter((g) => {
    const r = reviews[g.groupKey];
    return r && r.status !== "PENDING";
  }).length;
  const total = needsReviewGroups.length;
  const progress = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;
  const allDone = (reviewedCount === total && total > 0) || (total === 0 && alreadyApprovedGroups.length > 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#0f0f1a] border-b border-violet-500/20 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-violet-400 bg-violet-900/30 px-2 py-0.5 rounded">REVISÃO INTERNA</span>
            </div>
            <p className="text-white text-sm font-medium truncate mt-0.5">{campaign.name}</p>
            <p className="text-gray-500 text-xs truncate">Cliente: {campaign.client.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 bg-white/10 rounded-full h-1">
              <div className="bg-violet-500 h-1 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">{reviewedCount}/{total}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {alreadyApprovedGroups.length > 0 && needsReviewGroups.length > 0 ? (
          <p className="text-gray-400 text-sm">
            Fizemos os ajustes solicitados. Revise os itens abaixo e aprove ou solicite novos ajustes.
          </p>
        ) : (
          <p className="text-gray-400 text-sm">
            Revise cada item abaixo antes de enviar para o cliente. Aprove, solicite ajuste ou reprove com comentário.
          </p>
        )}

        {needsReviewGroups.map((group, gi) => {
          const review = reviews[group.groupKey];
          const status = review?.status || "PENDING";
          const isActive = activeGroup === group.groupKey;
          const items = group.type === "single" ? [group.item] : group.items;
          const isCarousel = group.type === "carousel";
          const currentSlide = carouselSlide[group.groupKey] || 0;
          const currentItem = items[currentSlide];

          return (
            <div
              key={group.groupKey}
              className={`bg-[#1a1a24] border rounded-xl overflow-hidden transition-all ${
                status === "APPROVED" ? "border-emerald-500/30"
                : status === "ADJUSTMENT" ? "border-amber-500/30"
                : status === "REJECTED" ? "border-red-500/30"
                : "border-violet-500/20"
              }`}
            >
              {isCarousel && (
                <div className="px-4 pt-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                    Carrossel — {items.length} slides
                  </span>
                </div>
              )}

              {/* Media */}
              {isCarousel && items.length > 1 ? (
                <div className="relative bg-black select-none">
                  <div className="overflow-hidden"
                    onTouchStart={(e) => {
                      (e.currentTarget as HTMLDivElement).dataset.startX = String(e.touches[0].clientX);
                    }}
                    onTouchEnd={(e) => {
                      const startX = Number((e.currentTarget as HTMLDivElement).dataset.startX);
                      const diffX = startX - e.changedTouches[0].clientX;
                      if (Math.abs(diffX) < 40) return;
                      if (diffX > 0) setCarouselSlide((p) => ({ ...p, [group.groupKey]: Math.min(items.length - 1, currentSlide + 1) }));
                      else setCarouselSlide((p) => ({ ...p, [group.groupKey]: Math.max(0, currentSlide - 1) }));
                    }}
                  >
                    <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                      {items.map((item) => (
                        <div key={item.id} className="w-full shrink-0">
                          {item.fileType === "IMAGE"
                            ? <img src={item.fileUrl} alt="" className="w-full max-h-[500px] object-contain" />
                            : <video src={item.fileUrl} controls className="w-full max-h-[500px]" />
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setCarouselSlide((p) => ({ ...p, [group.groupKey]: Math.max(0, currentSlide - 1) }))} disabled={currentSlide === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center disabled:opacity-20">‹</button>
                  <button onClick={() => setCarouselSlide((p) => ({ ...p, [group.groupKey]: Math.min(items.length - 1, currentSlide + 1) }))} disabled={currentSlide === items.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center disabled:opacity-20">›</button>
                </div>
              ) : (
                <>
                  <div className="relative bg-black">
                    {currentItem.fileType === "IMAGE" && (
                      <img src={currentItem.fileUrl} alt="" className="w-full max-h-[500px] object-contain" />
                    )}
                    {currentItem.fileType === "VIDEO" && (
                      <div className="relative">
                        <video src={currentItem.fileUrl} controls className="w-full max-h-[500px]" id={`vid-${currentItem.id}`} />
                        <button
                          onClick={() => { const v = document.getElementById(`vid-${currentItem.id}`) as HTMLVideoElement & { webkitEnterFullscreen?: () => void }; v?.requestFullscreen?.() ?? v?.webkitEnterFullscreen?.(); }}
                          className="absolute bottom-12 right-2 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        >⛶ Tela cheia</button>
                      </div>
                    )}
                    {currentItem.fileType === "PDF" && (
                      <div className="flex items-center justify-center h-32 gap-3">
                        <span className="text-3xl">📄</span>
                        <a href={currentItem.fileUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 text-sm">Abrir PDF →</a>
                      </div>
                    )}
                  </div>
                  {currentItem.contentType === "REELS" && currentItem.coverUrl && (
                    <div className="border-t border-white/10">
                      <div className="px-4 pt-3 pb-1">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Capa do Reels</span>
                      </div>
                      <div className="bg-black">
                        <img src={currentItem.coverUrl} alt="Capa do Reels" className="w-full max-h-[400px] object-contain" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {isCarousel && items.length > 1 && (
                <div className="flex justify-center gap-1.5 py-2 bg-black">
                  {items.map((_, si) => (
                    <button key={si} onClick={() => setCarouselSlide((p) => ({ ...p, [group.groupKey]: si }))}
                      className={`w-2 h-2 rounded-full transition-all ${si === currentSlide ? "bg-white scale-125" : "bg-white/30"}`}
                    />
                  ))}
                </div>
              )}

              {/* Info */}
              <div className="p-4">
                {!isCarousel && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                      {CONTENT_TYPE_LABELS[currentItem.contentType]}
                    </span>
                    {currentItem.scheduledDate && (
                      <span className="text-xs text-gray-500">{new Date(currentItem.scheduledDate).toLocaleDateString("pt-BR")}</span>
                    )}
                    <span className="text-xs text-gray-600">#{gi + 1}</span>
                  </div>
                )}

                {currentItem.caption && (
                  <div className="bg-black/30 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{currentItem.caption}</p>
                  </div>
                )}

                {/* Action buttons */}
                {status === "PENDING" || isActive ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGroupStatus(group.groupKey, "APPROVED", items)}
                        disabled={savingGroup === group.groupKey}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium border-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      >✅ Aprovar</button>
                      <button
                        onClick={() => { setReviews((p) => ({ ...p, [group.groupKey]: { status: "ADJUSTMENT", comment: p[group.groupKey]?.comment || "" } })); setActiveGroup(group.groupKey); }}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium border-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                      >✏️ Ajuste</button>
                      <button
                        onClick={() => { setReviews((p) => ({ ...p, [group.groupKey]: { status: "REJECTED", comment: p[group.groupKey]?.comment || "" } })); setActiveGroup(group.groupKey); }}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium border-2 border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                      >❌ Reprovar</button>
                    </div>

                    {isActive && (review?.status === "ADJUSTMENT" || review?.status === "REJECTED") && (
                      <div className="space-y-2">
                        <textarea
                          value={review.comment}
                          onChange={(e) => setReviews((p) => ({ ...p, [group.groupKey]: { ...p[group.groupKey], comment: e.target.value } }))}
                          rows={3}
                          required
                          placeholder={review.status === "ADJUSTMENT" ? "Descreva o que precisa ser ajustado..." : "Explique o motivo da reprovação..."}
                          className="w-full bg-[#0a0a0f] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setActiveGroup(null); setReviews((p) => { const u = { ...p }; delete u[group.groupKey]; return u; }); }}
                            className="flex-1 py-2 rounded-lg text-sm bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                          >Cancelar</button>
                          <button
                            onClick={() => handleCommentSave(group.groupKey, items)}
                            disabled={savingGroup === group.groupKey}
                            className="flex-1 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-60"
                          >{savingGroup === group.groupKey ? "Salvando..." : "Confirmar"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : status === "ADJUSTMENT" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {status === "APPROVED" ? "✅ Aprovado" : status === "ADJUSTMENT" ? "✏️ Ajuste Solicitado" : "❌ Reprovado"}
                      <button
                        onClick={() => { setActiveGroup(group.groupKey); setReviews((p) => ({ ...p, [group.groupKey]: { ...p[group.groupKey], status: "PENDING" as Status } })); }}
                        className="ml-auto text-xs opacity-60 hover:opacity-100 underline"
                      >Alterar</button>
                    </div>
                    {review?.comment && (
                      <div className="text-xs text-gray-400 bg-white/5 rounded-lg px-3 py-2">{review.comment}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Already approved section */}
        {alreadyApprovedGroups.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              Já aprovados ({alreadyApprovedGroups.length})
            </p>
            <div className="space-y-2">
              {alreadyApprovedGroups.map((group) => {
                const items = group.type === "single" ? [group.item] : group.items;
                const firstItem = items[0];
                return (
                  <div key={group.groupKey} className="bg-[#1a1a24] border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
                    {firstItem.fileType === "IMAGE" && (
                      <img src={firstItem.fileUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-sm truncate">
                        {group.type === "carousel" ? `Carrossel — ${items.length} slides` : CONTENT_TYPE_LABELS[firstItem.contentType]}
                      </p>
                      {firstItem.caption && (
                        <p className="text-gray-500 text-xs truncate mt-0.5">{firstItem.caption}</p>
                      )}
                    </div>
                    <span className="text-xs text-emerald-400 font-medium shrink-0">✅ Aprovado</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="sticky bottom-4 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!allDone || submitting || savingGroup !== null}
            className={`w-full py-4 rounded-xl text-base font-semibold transition-all ${
              allDone ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40"
              : "bg-white/5 text-gray-500 cursor-not-allowed"
            }`}
          >
            {submitting ? "Enviando..." : savingGroup !== null ? "Salvando..." : allDone ? "Finalizar Revisão Interna" : `Revise todos os itens (${reviewedCount}/${total})`}
          </button>
        </div>
      </main>

      <footer className="text-center py-8 text-gray-700 text-xs">
        BRJ Mídias · Revisão Interna
      </footer>
    </div>
  );
}
