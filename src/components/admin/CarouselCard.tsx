"use client";

import { useState, useEffect, useRef } from "react";
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
  clientComment: string | null;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onReorder: (slides: SlideItem[]) => void;
}

function SortableSlide({
  slide,
  index,
  onDelete,
  onPreview,
}: {
  slide: SlideItem;
  index: number;
  onDelete: (id: string) => void;
  onPreview: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusKey = (slide.approvalItem?.status || "PENDING") as ApprovalStatus;

  return (
    <div ref={setNodeRef} style={style} className="shrink-0 w-24">
      <div className="w-24 h-24 rounded-lg overflow-hidden bg-black/40 relative">
        {/* Drag handle — área superior */}
        <div
          className="absolute top-0 left-0 right-0 h-7 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center bg-gradient-to-b from-black/50 to-transparent"
          {...attributes}
          {...listeners}
        >
          <span className="text-white/60 text-xs select-none">⠿ arrastar</span>
        </div>

        {/* Imagem clicável para preview */}
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
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${APPROVAL_STATUS_COLORS[statusKey]}`}>
          {APPROVAL_STATUS_LABELS[statusKey]}
        </span>
        <button
          onClick={() => onDelete(slide.id)}
          className="text-red-500 hover:text-red-400 text-xs"
        >
          ✕
        </button>
      </div>
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
  clientComment,
  onDelete,
  onEdit,
  onReorder,
}: Props) {
  const [slides, setSlides] = useState(initialSlides);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const imageUrls = slides.filter((s) => s.fileType === "IMAGE").map((s) => s.fileUrl);

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
                onDelete={onDelete}
                onPreview={setPreviewIndex}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {caption && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{caption}</p>}
      {clientComment && (
        <div className="mt-2 text-xs text-amber-400 bg-amber-900/20 rounded-lg px-2.5 py-1.5">
          <span className="text-amber-500/70">Comentário do cliente: </span>
          {clientComment}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onEdit}
          className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
        >
          Editar / Adicionar slides
        </button>
      </div>
    </>
  );
}
