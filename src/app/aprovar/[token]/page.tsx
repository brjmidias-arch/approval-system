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
  let i = 0;
  while (i < items.length) {
    if (items[i].contentType === "CARROSSEL") {
      const slides: ContentItem[] = [items[i]];
      while (i + 1 < items.length && items[i + 1].contentType === "CARROSSEL") {
        i++;
        slides.push(items[i]);
      }
      groups.push({ type: "carousel", items: slides, groupKey: slides[0].id });
    } else {
      groups.push({ type: "single", item: items[i], groupKey: items[i].id });
    }
    i++;
  }
  return groups;
}

export default function ApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<"expired" | "closed" | "not_found" | null>(null);
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
    if (res.status === 410) { setError("expired"); setLoading(false); return; }
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
    for (const item of groupItems) {
      await fetch(`/api/approval/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentItemId: item.id,
          status: review.status,
          clientComment: review.comment || null,
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

  async function handleSubmit() {
    const allDone = groups.every((g) => {
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
      expired: { icon: "🔒", title: "Link Expirado", desc: "O prazo para aprovação deste conteúdo já passou. Entre em contato com a agência." },
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

  const reviewedCount = groups.filter((g) => {
    const r = reviews[g.groupKey];
    return r && r.status !== "PENDING";
  }).length;
  const total = groups.length;
  const progress = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;
  const allDone = reviewedCount === total && total > 0;

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#141414] border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">BRJ Mídias</p>
              <h1 className="text-white font-semibold text-lg leading-tight">{campaign.name}</h1>
              <p className="text-gray-400 text-xs mt-0.5">
                Olá, {campaign.client.name} · Expira em {new Date(campaign.expiresAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{reviewedCount} de {total} revisados</p>
              <p className="text-sm font-medium text-white">{progress}%</p>
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 mt-3">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <p className="text-gray-400 text-sm">
          Revise cada item abaixo. Clique em <span className="text-emerald-400">Aprovar</span> para confirmar, ou solicite ajuste/reprovação com um comentário.
        </p>

        {groups.map((group, gi) => {
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
              <div className="relative bg-black">
                {currentItem.fileType === "IMAGE" && (
                  <div className="relative">
                    <img
                      src={currentItem.fileUrl}
                      alt=""
                      className="w-full max-h-[500px] object-contain"
                    />
                    <div className="absolute inset-0 flex items-end justify-end p-3 pointer-events-none">
                      <span className="text-white/30 text-xs font-medium tracking-wider select-none">
                        PRÉVIA · BRJ Mídias
                      </span>
                    </div>
                  </div>
                )}
                {currentItem.fileType === "VIDEO" && (
                  <div className="relative">
                    <video src={currentItem.fileUrl} controls className="w-full max-h-[500px]" />
                    <div className="absolute top-2 right-2 pointer-events-none">
                      <span className="text-white/40 text-xs bg-black/50 px-2 py-1 rounded select-none">
                        PRÉVIA · BRJ Mídias
                      </span>
                    </div>
                  </div>
                )}
                {currentItem.fileType === "PDF" && (
                  <div className="flex items-center justify-center h-32 gap-3">
                    <span className="text-3xl">📄</span>
                    <a href={currentItem.fileUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-sm">
                      Abrir PDF →
                    </a>
                  </div>
                )}

                {/* Carousel navigation arrows */}
                {isCarousel && items.length > 1 && (
                  <>
                    <button
                      onClick={() => setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: Math.max(0, currentSlide - 1) }))}
                      disabled={currentSlide === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/80 transition-colors"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: Math.min(items.length - 1, currentSlide + 1) }))}
                      disabled={currentSlide === items.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/80 transition-colors"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {/* Carousel dots */}
              {isCarousel && items.length > 1 && (
                <div className="flex justify-center gap-1.5 py-2 bg-black">
                  {items.map((_, si) => (
                    <button
                      key={si}
                      onClick={() => setCarouselSlide((prev) => ({ ...prev, [group.groupKey]: si }))}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${si === currentSlide ? "bg-white" : "bg-white/30"}`}
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
