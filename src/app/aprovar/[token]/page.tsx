"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CONTENT_TYPE_LABELS } from "@/types";
import type { ContentType } from "@/types";

type Status = "PENDING" | "APPROVED" | "ADJUSTMENT" | "REJECTED";

interface ContentItem {
  id: string;
  fileUrl: string;
  fileType: string;
  caption: string | null;
  scheduledDate: string | null;
  contentType: ContentType;
  groupId: string | null;
  coverUrl: string | null;
  driveUrl: string | null;
  approvalItem: { status: Status; clientComment: string | null } | null;
}

interface Campaign {
  id: string;
  name: string;
  token: string;
  expiresAt: string;
  status: string;
  client: { name: string };
  contentItems: ContentItem[];
}

type LocalReview = { status: Status; comment: string };

// A "group" is either a single item or a carousel (multiple slides)
type Group =
  | { type: "single"; item: ContentItem; groupKey: string }
  | { type: "carousel"; items: ContentItem[]; groupKey: string };

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

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

export default function ApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<"closed" | "not_found" | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Record<string, LocalReview>>({});
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [carouselSlide, setCarouselSlide] = useState<Record<string, number>>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ approved: number; adjustment: number; rejected: number } | null>(null);

  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/approval/${token}`);
    if (res.status === 404) { setError("not_found"); setLoading(false); return; }
    const data: Campaign = await res.json();
    if (data.status === "CLOSED") { setError("closed"); setLoading(false); return; }
    setCampaign(data);

    const built = buildGroups(data.contentItems);
    setGroups(built);

    // Pre-fill from existing approvals
    const initial: Record<string, LocalReview> = {};
    for (const g of built) {
      const firstItem = g.type === "single" ? g.item : g.items[0];
      if (firstItem.approvalItem && firstItem.approvalItem.status !== "PENDING") {
        initial[g.groupKey] = {
          status: firstItem.approvalItem.status,
          comment: firstItem.approvalItem.clientComment || "",
        };
      }
    }
    setReviews(initial);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  async function saveGroupReview(groupKey: string, review: LocalReview, groupItems: ContentItem[]) {
    setSavingGroup(groupKey);
    try {
      for (const item of groupItems) {
        const res = await fetch(`/api/approval/${token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentItemId: item.id,
            status: review.status,
            clientComment: review.comment || null,
          }),
        });
        if (!res.ok) throw new Error("Erro ao salvar avaliação. Tente novamente.");
      }
    } catch (err) {
      setSavingGroup(null);
      alert(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
      throw err;
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

  // Split groups: already approved vs needs review
  // (computed here so handleSubmit can use it)
  const alreadyApprovedGroups = groups.filter((g) => {
    const firstItem = g.type === "single" ? g.item : g.items[0];
    return firstItem.approvalItem?.status === "APPROVED";
  });
  const needsReviewGroups = groups.filter((g) => {
    const firstItem = g.type === "single" ? g.item : g.items[0];
    return firstItem.approvalItem?.status !== "APPROVED";
  });

  async function handleSubmit() {
    const allDone = needsReviewGroups.every((g) => {
      const r = reviews[g.groupKey];
      return r && r.status !== "PENDING";
    });
    if (!allDone) { alert("Por favor, revise todos os itens antes de enviar."); return; }
    setSubmitting(true);
    const res = await fetch(`/api/approval/${token}/submit`, { method: "POST" });
    const data = await res.json();
    if (res.ok) { setSubmitted(true); setSubmitResult(data); }
    else alert(data.error || "Erro ao enviar revisão.");
    setSubmitting(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <p className="text-gray-400">Carregando...</p>
    </div>
  );

  if (error) {
    const msgs = {
      closed: { icon: "✅", title: "Revisão Concluída", desc: "Esta campanha já foi finalizada. Obrigado!" },
      not_found: { icon: "🔒", title: "Link Inválido", desc: "Este link de aprovação não existe ou foi removido." },
    };
    const m = msgs[error];
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">{m.icon}</div>
          <h1 className="text-xl font-semibold text-white mb-2">{m.title}</h1>
          <p className="text-gray-400 text-sm">{m.desc}</p>
          <p className="text-gray-600 text-xs mt-6">BRJ Mídias</p>
        </div>
      </div>
    );
  }

  if (submitted && submitResult) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-white mb-2">Revisão Enviada!</h1>
          <p className="text-gray-400 text-sm mb-6">Obrigado! A equipe da BRJ Mídias já foi notificada.</p>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Aprovados</span><span className="text-emerald-400 font-medium">{submitResult.approved}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Com ajuste</span><span className="text-amber-400 font-medium">{submitResult.adjustment}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Reprovados</span><span className="text-red-400 font-medium">{submitResult.rejected}</span>
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-8">BRJ Mídias</p>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const alreadyApproved = alreadyApprovedGroups;
  const needsReview = needsReviewGroups;

  const reviewedCount = needsReview.filter((g) => {
    const r = reviews[g.groupKey];
    return r && r.status !== "PENDING";
  }).length;
  const total = needsReview.length;
  const progress = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;
  const allDone = reviewedCount === total && total > 0;

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#141414] border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{campaign.name}</p>
            <p className="text-gray-500 text-xs truncate">Olá, {campaign.client.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 bg-white/10 rounded-full h-1">
              <div className="bg-emerald-500 h-1 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">{reviewedCount}/{total}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {alreadyApproved.length > 0 && needsReview.length > 0 ? (
          <p className="text-gray-400 text-sm">
            Fizemos os ajustes solicitados. Revise os itens abaixo e aprove ou solicite novos ajustes.
          </p>
        ) : (
          <p className="text-gray-400 text-sm">
            Revise cada item abaixo. Clique em <span className="text-emerald-400">Aprovar</span> para confirmar, ou solicite ajuste/reprovação com um comentário.
          </p>
        )}

        {needsReview.map((group, gi) => {
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
              className={`bg-[#1a1a1a] border rounded-xl overflow-hidden transition-all ${
                status === "APPROVED" ? "border-emerald-500/30"
                : status === "ADJUSTMENT" ? "border-amber-500/30"
                : status === "REJECTED" ? "border-red-500/30"
                : "border-white/10"
              }`}
            >
              {/* Carousel badge */}
              {isCarousel && (
                <div className="px-4 pt-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                    Carrossel — {items.length} slides
                  </span>
                  {currentItem.scheduledDate && (
                    <span className="text-xs text-gray-500">
                      {new Date(currentItem.scheduledDate).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              )}

              {/* Media */}
              {isCarousel && items.length > 1 ? (
                // Carousel with swipe support
                <div className="relative bg-black select-none">
                  {/* Preload all images */}
                  <div className="hidden">
                    {items.filter(i => i.fileType === "IMAGE").map(i => (
                      <img key={i.id} src={i.fileUrl} alt="" />
                    ))}
                  </div>

                  {/* Sliding track */}
                  <div
                    className="overflow-hidden"
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      (e.currentTarget as HTMLDivElement).dataset.startX = String(touch.clientX);
                      (e.currentTarget as HTMLDivElement).dataset.startY = String(touch.clientY);
                    }}
                    onTouchEnd={(e) => {
                      const startX = Number((e.currentTarget as HTMLDivElement).dataset.startX);
                      const startY = Number((e.currentTarget as HTMLDivElement).dataset.startY);
                      const endX = e.changedTouches[0].clientX;
                      const endY = e.changedTouches[0].clientY;
                      const diffX = startX - endX;
                      const diffY = Math.abs(startY - e.changedTouches[0].clientY);
                      // Only swipe if horizontal movement dominates
                      if (Math.abs(diffX) < 40 || diffY > Math.abs(diffX)) return;
                      if (diffX > 0) {
                        setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: Math.min(items.length - 1, currentSlide + 1) }));
                      } else {
                        setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: Math.max(0, currentSlide - 1) }));
                      }
                    }}
                  >
                    <div
                      className="flex transition-transform duration-300 ease-out"
                      style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                    >
                      {items.map((item) => (
                        <div key={item.id} className="w-full shrink-0 relative">
                          {item.fileType === "IMAGE" ? (
                            <>
                              <img src={item.fileUrl} alt="" className="w-full max-h-[500px] object-contain" />
                              <div className="absolute inset-0 flex items-end justify-end p-3 pointer-events-none">
                                <span className="text-white/30 text-xs font-medium tracking-wider select-none">PRÉVIA · BRJ Mídias</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-center bg-black w-full">
                              <div className="relative flex flex-col items-center justify-center overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: 500, width: "calc(500px * 9 / 16)" }}>
                                {item.coverUrl
                                  ? <img src={item.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                                  : null}
                                <a href={item.driveUrl ?? item.fileUrl} target="_blank" rel="noopener noreferrer" className="relative z-10 flex flex-col items-center gap-3">
                                  <div className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm">
                                    <span className="text-white text-3xl ml-1">▶</span>
                                  </div>
                                  <span className="text-white/80 text-sm font-medium">Assistir vídeo no Drive</span>
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Arrows — visible on desktop, subtle on mobile */}
                  <button
                    onClick={() => setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: Math.max(0, currentSlide - 1) }))}
                    disabled={currentSlide === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center disabled:opacity-20 transition-opacity"
                  >‹</button>
                  <button
                    onClick={() => setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: Math.min(items.length - 1, currentSlide + 1) }))}
                    disabled={currentSlide === items.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center disabled:opacity-20 transition-opacity"
                  >›</button>
                </div>
              ) : (
                // Single item
                <>
                  <div className="relative bg-black">
                    {currentItem.fileType === "IMAGE" && (
                      <div className="relative">
                        <img src={currentItem.fileUrl} alt="" className="w-full max-h-[500px] object-contain" />
                        <div className="absolute inset-0 flex items-end justify-end p-3 pointer-events-none">
                          <span className="text-white/30 text-xs font-medium tracking-wider select-none">PRÉVIA · BRJ Mídias</span>
                        </div>
                      </div>
                    )}
                    {currentItem.fileType === "VIDEO" && (
                      <div className="flex justify-center bg-black w-full">
                        <div className="relative flex flex-col items-center justify-center overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: 500, width: "calc(500px * 9 / 16)" }}>
                          {currentItem.coverUrl
                            ? <img src={currentItem.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                            : null}
                          <a href={currentItem.driveUrl ?? currentItem.fileUrl} target="_blank" rel="noopener noreferrer" className="relative z-10 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm">
                              <span className="text-white text-3xl ml-1">▶</span>
                            </div>
                            <span className="text-white/80 text-sm font-medium">Assistir vídeo no Drive</span>
                          </a>
                        </div>
                      </div>
                    )}
                    {currentItem.fileType === "PDF" && (
                      <div className="flex items-center justify-center h-32 gap-3">
                        <span className="text-3xl">📄</span>
                        <a href={currentItem.fileUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-sm">Abrir PDF →</a>
                      </div>
                    )}
                  </div>

                  {/* Capa do Reels */}
                  {currentItem.contentType === "REELS" && currentItem.coverUrl && (
                    <div className="border-t border-white/10">
                      <div className="px-4 pt-3 pb-1">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Capa do Reels</span>
                      </div>
                      <div className="relative bg-black">
                        <img src={currentItem.coverUrl} alt="Capa do Reels" className="w-full max-h-[400px] object-contain" />
                        <div className="absolute inset-0 flex items-end justify-end p-3 pointer-events-none">
                          <span className="text-white/30 text-xs font-medium tracking-wider select-none">PRÉVIA · BRJ Mídias</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Dots */}
              {isCarousel && items.length > 1 && (
                <div className="flex justify-center gap-1.5 py-2 bg-black">
                  {items.map((_, si) => (
                    <button
                      key={si}
                      onClick={() => setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: si }))}
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
                      <span className="text-xs text-gray-500">
                        {new Date(currentItem.scheduledDate).toLocaleDateString("pt-BR")}
                      </span>
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
                      >
                        ✅ Aprovar
                      </button>
                      <button
                        onClick={() => {
                          setReviews((prev) => ({ ...prev, [group.groupKey]: { status: "ADJUSTMENT", comment: prev[group.groupKey]?.comment || "" } }));
                          setActiveGroup(group.groupKey);
                        }}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium border-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                      >
                        ✏️ Solicitar Ajuste
                      </button>
                      <button
                        onClick={() => {
                          setReviews((prev) => ({ ...prev, [group.groupKey]: { status: "REJECTED", comment: prev[group.groupKey]?.comment || "" } }));
                          setActiveGroup(group.groupKey);
                        }}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium border-2 border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        ❌ Reprovar
                      </button>
                    </div>

                    {isActive && (review?.status === "ADJUSTMENT" || review?.status === "REJECTED") && (
                      <div className="space-y-2">
                        <textarea
                          value={review.comment}
                          onChange={(e) => setReviews((prev) => ({ ...prev, [group.groupKey]: { ...prev[group.groupKey], comment: e.target.value } }))}
                          rows={3}
                          required
                          placeholder={review.status === "ADJUSTMENT" ? "Descreva o que precisa ser ajustado..." : "Explique o motivo da reprovação..."}
                          className="w-full bg-[#0f0f0f] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActiveGroup(null);
                              setReviews((prev) => { const u = { ...prev }; delete u[group.groupKey]; return u; });
                            }}
                            className="flex-1 py-2 rounded-lg text-sm bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleCommentSave(group.groupKey, items)}
                            disabled={savingGroup === group.groupKey}
                            className="flex-1 py-2 rounded-lg text-sm bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors disabled:opacity-60"
                          >
                            {savingGroup === group.groupKey ? "Salvando..." : "Confirmar"}
                          </button>
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
                        onClick={() => {
                          setActiveGroup(group.groupKey);
                          setReviews((prev) => ({ ...prev, [group.groupKey]: { ...prev[group.groupKey], status: "PENDING" as Status } }));
                        }}
                        className="ml-auto text-xs opacity-60 hover:opacity-100 underline"
                      >
                        Alterar
                      </button>
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
        {alreadyApproved.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              Já aprovados anteriormente ({alreadyApproved.length})
            </p>
            <div className="space-y-2">
              {alreadyApproved.map((group) => {
                const items = group.type === "single" ? [group.item] : group.items;
                const firstItem = items[0];
                return (
                  <div key={group.groupKey} className="bg-[#1a1a1a] border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
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
              allDone ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40"
              : "bg-white/5 text-gray-500 cursor-not-allowed"
            }`}
          >
            {submitting ? "Enviando..." : savingGroup !== null ? "Salvando..." : allDone ? "Finalizar e Enviar Revisão" : `Revise todos os itens (${reviewedCount}/${total})`}
          </button>
        </div>
      </main>

      <footer className="text-center py-8 text-gray-700 text-xs">
        BRJ Mídias · Sistema de Aprovação de Conteúdo
      </footer>
    </div>
  );
}
