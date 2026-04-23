"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { APPROVAL_STATUS_COLORS, APPROVAL_STATUS_LABELS } from "@/types";
import type { ApprovalStatus } from "@/types";

interface SlideItem {
  id: string;
  fileUrl: string;
  fileType: string;
  order: number;
  approvalItem: { status: ApprovalStatus; clientComment: string | null } | null;
}


interface Props {
  campaignId: string;
  slides: SlideItem[];
  title: string | null;
  caption: string | null;
  scheduledDate: string | null;
  driveUrl: string | null;
  clientComment: string | null;
  clientCommentResolved: boolean;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onReorder: (slides: SlideItem[]) => void;
}

function SortableSlide({
  slide,
  index,
  campaignId,
  onDelete,
  onPreview,
  onReplaced,
}: {
  slide: SlideItem;
  index: number;
  campaignId: string;
  onDelete: (id: string) => void;
  onPreview: (index: number) => void;
  onReplaced: (id: string, fileUrl: string, fileType: string) => void;
}) {
  const [replacing, setReplacing] = useState(false);
  const [driveInput, setDriveInput] = useState("");
  const [saving, setSaving] = useState(false);

  const isSupabase = slide.fileUrl.includes("supabase");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function extractDriveId(url: string): string | null {
    const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  }

  async function handleReplace() {
    const fileId = extractDriveId(driveInput);
    if (!fileId) return alert("Link do Drive não reconhecido.");
    setSaving(true);
    const newFileUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    const newDriveUrl = `https://drive.google.com/file/d/${fileId}/view`;
    await fetch(`/api/admin/campaigns/${campaignId}/items/${slide.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl: newFileUrl, fileType: "IMAGE", driveUrl: newDriveUrl }),
    });
    onReplaced(slide.id, newFileUrl, "IMAGE");
    setSaving(false);
    setReplacing(false);
    setDriveInput("");
  }

  return (
    <div ref={setNodeRef} style={style} className="shrink-0 w-24">
      <div className="w-24 h-24 rounded-lg overflow-hidden bg-black/40 relative">
        <div
          className="absolute top-0 left-0 right-0 h-7 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center bg-gradient-to-b from-black/50 to-transparent"
          {...attributes}
          {...listeners}
        >
          <span className="text-white/60 text-xs select-none">⠿ arrastar</span>
        </div>

        {slide.fileType === "IMAGE" ? (
          <img
            src={slide.fileUrl}
            alt=""
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => onPreview(index)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
        )}

        <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded pointer-events-none">
          {index + 1}
        </span>

        {isSupabase && (
          <div className="absolute bottom-1 right-1">
            <span className="text-xs bg-orange-500/80 text-white px-1 rounded">S</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${APPROVAL_STATUS_COLORS[(slide.approvalItem?.status || "PENDING") as ApprovalStatus]}`}>
          {APPROVAL_STATUS_LABELS[(slide.approvalItem?.status || "PENDING") as ApprovalStatus]}
        </span>
        <button onClick={() => onDelete(slide.id)} className="text-red-500 hover:text-red-400 text-xs">✕</button>
      </div>

      {isSupabase && !replacing && (
        <button
          onClick={() => setReplacing(true)}
          className="mt-1 w-full text-xs px-1.5 py-1 bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 border border-orange-500/30 rounded-lg transition-colors"
        >
          → Drive
        </button>
      )}

      {replacing && (
        <div className="mt-1 space-y-1">
          <input
            autoFocus
            type="text"
            value={driveInput}
            onChange={(e) => setDriveInput(e.target.value)}
            placeholder="Link Drive"
            className="w-full bg-black/60 border border-white/20 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-orange-400"
          />
          <div className="flex gap-1">
            <button
              onClick={handleReplace}
              disabled={saving || !driveInput.trim()}
              className="flex-1 text-xs py-0.5 bg-orange-600 hover:bg-orange-500 text-white rounded disabled:opacity-40"
            >
              {saving ? "..." : "OK"}
            </button>
            <button
              onClick={() => { setReplacing(false); setDriveInput(""); }}
              className="flex-1 text-xs py-0.5 bg-white/10 text-gray-400 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Lightbox({
  urls,
  initialIndex,
  onClose,
}: {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, urls.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, urls.length]);

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl w-full flex items-center" onClick={(e) => e.stopPropagation()}>
        {/* Seta esquerda */}
        <button
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="absolute -left-12 text-white/60 hover:text-white text-4xl disabled:opacity-20 transition-colors select-none"
        >
          ‹
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/40 text-xs">{index + 1} / {urls.length}</span>
            <button onClick={onClose} className="text-white/60 hover:text-white text-sm">
              ✕ Fechar (Esc)
            </button>
          </div>
          <img src={urls[index]} alt="" className="w-full rounded-xl object-contain max-h-[85vh]" />
        </div>

        {/* Seta direita */}
        <button
          onClick={() => setIndex((i) => Math.min(i + 1, urls.length - 1))}
          disabled={index === urls.length - 1}
          className="absolute -right-12 text-white/60 hover:text-white text-4xl disabled:opacity-20 transition-colors select-none"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function CarouselCard({
  campaignId,
  slides: initialSlides,
  title,
  caption,
  scheduledDate,
  driveUrl,
  clientComment,
  clientCommentResolved,
  onDelete,
  onEdit,
  onReorder,
}: Props) {
  const [slides, setSlides] = useState(initialSlides);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const imageUrls = slides.filter((s) => s.fileType === "IMAGE").map((s) => s.fileUrl);

  function handleReplaced(id: string, fileUrl: string, fileType: string) {
    setSlides((prev) => prev.map((s) => s.id === id ? { ...s, fileUrl, fileType } : s));
  }

  const [markingDone, setMarkingDone] = useState(false);

  const hasAdjustments = slides.some((s) => {
    const st = s.approvalItem?.status;
    return st === "ADJUSTMENT" || st === "REJECTED";
  });

  async function handleMarkAllDone() {
    setMarkingDone(true);
    try {
      const toReset = slides.filter((s) => {
        const st = s.approvalItem?.status;
        return st === "ADJUSTMENT" || st === "REJECTED";
      });
      await Promise.all(
        toReset.map((s) =>
          fetch(`/api/admin/campaigns/${campaignId}/items/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resetApproval: true }),
          })
        )
      );
      setSlides((prev) =>
        prev.map((s) => {
          const st = s.approvalItem?.status;
          if (st === "ADJUSTMENT" || st === "REJECTED") {
            return { ...s, approvalItem: s.approvalItem ? { ...s.approvalItem, status: "PENDING" as ApprovalStatus, clientComment: null } : null };
          }
          return s;
        })
      );
    } catch {
      alert("Erro ao marcar ajustes. Tente novamente.");
    } finally {
      setMarkingDone(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(slides, oldIndex, newIndex).map((s, i) => ({ ...s, order: i + 1 }));

    setSlides(reordered);
    onReorder(reordered);

    await fetch(`/api/admin/campaigns/${campaignId}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reordered.map((s) => ({ id: s.id, order: s.order })) }),
    });
  }

  return (
    <>
      {previewIndex !== null && (
        <Lightbox
          urls={imageUrls}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, si) => (
              <SortableSlide
                key={slide.id}
                slide={slide}
                index={si}
                campaignId={campaignId}
                onDelete={onDelete}
                onPreview={setPreviewIndex}
                onReplaced={handleReplaced}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {caption && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{caption}</p>}
      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          🔗 Abrir no Drive
        </a>
      )}
      {clientComment && (
        <div className={`mt-2 text-xs rounded-lg px-2.5 py-1.5 ${clientCommentResolved ? "text-amber-400/50 bg-amber-900/10" : "text-amber-400 bg-amber-900/20"}`}>
          <span className="opacity-70">Comentário do cliente: </span>
          <span className={clientCommentResolved ? "line-through opacity-60" : ""}>{clientComment}</span>
          {clientCommentResolved && <span className="ml-1.5">✅</span>}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onEdit}
          className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
        >
          Editar / Adicionar slides
        </button>
        {hasAdjustments && (
          <button
            onClick={handleMarkAllDone}
            disabled={markingDone}
            className="text-xs px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50"
          >
            {markingDone ? "Salvando..." : "Ajuste feito"}
          </button>
        )}
      </div>
    </>
  );
}
