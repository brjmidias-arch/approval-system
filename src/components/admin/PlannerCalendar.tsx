"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";

interface Post {
  id: string;
  title: string | null;
  contentType: string;
  fileUrl: string;
  coverUrl: string | null;
  scheduledDate: string | null;
  clientName: string;
  campaignName: string;
  campaignId: string;
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
  CARROSSEL: "bg-purple-900/60 border-purple-500/40 text-purple-300",
  POST_FEED: "bg-blue-900/60 border-blue-500/40 text-blue-300",
  REELS: "bg-pink-900/60 border-pink-500/40 text-pink-300",
  STORIES: "bg-amber-900/60 border-amber-500/40 text-amber-300",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post",
  REELS: "Reels",
  STORIES: "Stories",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const color = CONTENT_TYPE_COLORS[post.contentType] ?? "bg-white/10 border-white/20 text-gray-300";
  const thumb = post.coverUrl || (post.fileUrl.includes("thumbnail") ? post.fileUrl : null);

  if (compact) {
    return (
      <div className={`rounded border px-1.5 py-0.5 text-xs truncate ${color}`}>
        <span className="font-medium truncate">{post.clientName}</span>
        <span className="opacity-60 ml-1">{CONTENT_TYPE_LABELS[post.contentType]}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border px-2 py-1.5 text-xs ${color} flex items-center gap-2`}>
      {thumb && (
        <img src={thumb} alt="" className="w-8 h-8 rounded object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      <div className="min-w-0">
        <p className="font-semibold truncate">{post.clientName}</p>
        <p className="opacity-70 truncate">{post.title || CONTENT_TYPE_LABELS[post.contentType]}</p>
      </div>
    </div>
  );
}

function DraggablePost({ post, compact }: { post: Post; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: "grab", touchAction: "none" }}
    >
      <PostCard post={post} compact={compact} />
    </div>
  );
}

function DroppableDay({ dateKey, children, isToday, isPast }: {
  dateKey: string;
  children: React.ReactNode;
  isToday: boolean;
  isPast: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg p-1 border transition-colors ${
        isOver ? "border-emerald-400 bg-emerald-900/20" :
        isToday ? "border-white/30 bg-white/5" :
        isPast ? "border-white/5 bg-white/[0.01]" :
        "border-white/10 bg-white/[0.02]"
      }`}
    >
      {children}
    </div>
  );
}

export default function PlannerCalendar({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const scheduledPosts = posts.filter((p) => p.scheduledDate !== null);
  const unscheduledPosts = posts.filter((p) => p.scheduledDate === null);

  function getPostsForDate(dateKey: string) {
    return scheduledPosts.filter((p) => p.scheduledDate!.slice(0, 10) === dateKey);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function buildCalendarDays() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (string | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const month = String(viewMonth + 1).padStart(2, "0");
      const day = String(d).padStart(2, "0");
      days.push(`${viewYear}-${month}-${day}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }

  const calendarDays = buildCalendarDays();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function handleDragStart(event: DragStartEvent) {
    const post = posts.find((p) => p.id === event.active.id);
    setActivePost(post ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActivePost(null);
    const { active, over } = event;
    if (!over) return;

    const postId = active.id as string;
    const dateKey = over.id as string;

    // Validate date key format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;

    const post = posts.find((p) => p.id === postId);
    if (!post || post.scheduledDate?.slice(0, 10) === dateKey) return;

    // Optimistic update
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, scheduledDate: dateKey + "T12:00:00.000Z" } : p));

    await fetch(`/api/admin/campaigns/${post.campaignId}/items/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: dateKey }),
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-[calc(100vh-120px)]">

        {/* Sidebar — unscheduled */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <div className="bg-[#141414] border border-white/10 rounded-xl p-3 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Sem data ({unscheduledPosts.length})
            </p>
            <div className="overflow-y-auto space-y-2 flex-1 pr-0.5">
              {unscheduledPosts.length === 0 && (
                <p className="text-xs text-gray-600 text-center mt-4">Todos os posts têm data</p>
              )}
              {unscheduledPosts.map((post) => (
                <DraggablePost key={post.id} post={post} />
              ))}
            </div>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p className="text-white/60 font-medium">Legenda</p>
            {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${CONTENT_TYPE_COLORS[k].split(" ")[0]}`} />
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-white font-semibold text-lg">Planner</h1>
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors">‹</button>
              <span className="text-white font-medium text-sm w-36 text-center">{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors">›</button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 flex-1 overflow-y-auto">
            {calendarDays.map((dateKey, i) => {
              if (!dateKey) return <div key={`empty-${i}`} />;
              const dayNum = Number(dateKey.slice(8));
              const dayPosts = getPostsForDate(dateKey);
              const isToday = dateKey === todayKey;
              const isPast = dateKey < todayKey;

              return (
                <DroppableDay key={dateKey} dateKey={dateKey} isToday={isToday} isPast={isPast}>
                  <div className={`text-xs font-medium mb-1 px-0.5 ${isToday ? "text-emerald-400" : isPast ? "text-gray-600" : "text-gray-400"}`}>
                    {dayNum}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((post) => (
                      <DraggablePost key={post.id} post={post} compact />
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-xs text-gray-500 px-1">+{dayPosts.length - 3} mais</div>
                    )}
                  </div>
                </DroppableDay>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePost && (
          <div style={{ width: 200 }}>
            <PostCard post={activePost} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
