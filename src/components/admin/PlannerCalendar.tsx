"use client";

import { useState, useEffect } from "react";
import {
  DndContext, DragOverlay, DragStartEvent, DragEndEvent,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
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

const TYPE_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  CARROSSEL: { bg: "bg-purple-800",  border: "border-purple-600", text: "text-purple-100", dot: "bg-purple-400" },
  POST_FEED: { bg: "bg-blue-800",    border: "border-blue-600",   text: "text-blue-100",   dot: "bg-blue-400"   },
  REELS:     { bg: "bg-pink-800",    border: "border-pink-600",   text: "text-pink-100",   dot: "bg-pink-400"   },
  STORIES:   { bg: "bg-amber-700",   border: "border-amber-500",  text: "text-amber-100",  dot: "bg-amber-400"  },
};
const DEFAULT_STYLE = { bg: "bg-zinc-700", border: "border-zinc-500", text: "text-zinc-100", dot: "bg-zinc-400" };

const CONTENT_TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel", POST_FEED: "Post", REELS: "Reels", STORIES: "Stories",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const s = TYPE_STYLE[post.contentType] ?? DEFAULT_STYLE;
  const thumb = post.coverUrl || (post.fileUrl.includes("thumbnail") ? post.fileUrl : null);

  if (compact) {
    return (
      <div className={`rounded border px-1.5 py-0.5 text-xs truncate ${s.bg} ${s.border} ${s.text}`}>
        <span className="font-semibold">{CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}</span>
        <span className="opacity-70 ml-1 truncate">{post.title || post.clientName}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border px-2 py-1.5 text-xs ${s.bg} ${s.border} ${s.text} flex items-center gap-2`}>
      {thumb && (
        <img src={thumb} alt="" className="w-8 h-8 rounded object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      <div className="min-w-0">
        <p className="font-semibold truncate">{post.title || CONTENT_TYPE_LABELS[post.contentType]}</p>
        <p className="opacity-75 truncate text-[10px]">{post.campaignName}</p>
      </div>
    </div>
  );
}

function DraggablePost({ post, compact }: { post: Post; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: "grab", touchAction: "none" }}>
      <PostCard post={post} compact={compact} />
    </div>
  );
}

function ManualNote({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="rounded border px-1.5 py-0.5 text-xs bg-zinc-700 border-zinc-500 text-zinc-100 flex items-center gap-1 group">
      <span className="truncate flex-1">{label}</span>
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400 transition-all leading-none shrink-0">×</button>
    </div>
  );
}

function DroppableDay({ dateKey, isToday, isPast, children, onAddNote }: {
  dateKey: string; isToday: boolean; isPast: boolean;
  children: React.ReactNode; onAddNote: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  return (
    <div ref={setNodeRef} className={`min-h-[80px] rounded-lg p-1 border transition-colors group/day relative ${
      isOver    ? "border-emerald-400 bg-emerald-900/30" :
      isToday   ? "border-white/40 bg-[#222]" :
      isPast    ? "border-white/5  bg-[#161616]" :
                  "border-white/10 bg-[#1a1a1a]"
    }`}>
      {children}
      <button
        onClick={onAddNote}
        className="absolute bottom-1 right-1 w-4 h-4 rounded text-gray-600 hover:text-white hover:bg-white/10 text-xs leading-none opacity-0 group-hover/day:opacity-100 transition-all flex items-center justify-center"
      >+</button>
    </div>
  );
}

interface NoteMap { [dateKey: string]: string[] }

export default function PlannerCalendar({ initialPosts, clientId, onDateChange }: {
  initialPosts: Post[];
  clientId?: string;
  onDateChange?: (postId: string, dateKey: string) => void;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [notes, setNotes] = useState<NoteMap>({});
  const [addingNoteDate, setAddingNoteDate] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const storageKey = `planner_notes_${clientId ?? "default"}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setNotes(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  function saveNotes(updated: NoteMap) {
    setNotes(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
  }

  function addNote(dateKey: string) {
    const label = noteInput.trim();
    if (!label) return;
    const updated = { ...notes, [dateKey]: [...(notes[dateKey] ?? []), label] };
    saveNotes(updated);
    setNoteInput("");
    setAddingNoteDate(null);
  }

  function removeNote(dateKey: string, idx: number) {
    const list = [...(notes[dateKey] ?? [])];
    list.splice(idx, 1);
    const updated = { ...notes, [dateKey]: list };
    saveNotes(updated);
  }

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
      days.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }

  const calendarDays = buildCalendarDays();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function handleDragStart(e: DragStartEvent) {
    setActivePost(posts.find((p) => p.id === e.active.id) ?? null);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActivePost(null);
    const { active, over } = e;
    if (!over) return;
    const postId = active.id as string;
    const dateKey = over.id as string;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const post = posts.find((p) => p.id === postId);
    if (!post || post.scheduledDate?.slice(0, 10) === dateKey) return;
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, scheduledDate: dateKey + "T12:00:00.000Z" } : p));
    onDateChange?.(postId, dateKey);
    await fetch(`/api/admin/campaigns/${post.campaignId}/items/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: dateKey }),
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full">

        {/* Sidebar */}
        <div className="w-52 shrink-0 flex flex-col gap-2">
          <div className="bg-[#111] border border-white/10 rounded-xl p-3 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Sem data ({unscheduledPosts.length})
            </p>
            <div className="overflow-y-auto space-y-1.5 flex-1">
              {unscheduledPosts.length === 0 && (
                <p className="text-xs text-gray-600 text-center mt-4">Todos os posts têm data</p>
              )}
              {unscheduledPosts.map((post) => <DraggablePost key={post.id} post={post} />)}
            </div>
          </div>
          <div className="bg-[#111] border border-white/10 rounded-xl p-3 text-xs text-gray-400 space-y-1.5">
            <p className="font-semibold text-gray-300">Legenda</p>
            {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${TYPE_STYLE[k]?.bg}`} />
                <span>{v}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-zinc-700" />
              <span>Manual</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-end gap-2">
            <button onClick={prevMonth} className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white text-lg flex items-center justify-center transition-colors">‹</button>
            <span className="text-white font-semibold text-sm w-36 text-center">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white text-lg flex items-center justify-center transition-colors">›</button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs text-gray-500 font-medium py-0.5">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1 overflow-y-auto content-start">
            {calendarDays.map((dateKey, i) => {
              if (!dateKey) return <div key={`e-${i}`} />;
              const dayNum = Number(dateKey.slice(8));
              const dayPosts = getPostsForDate(dateKey);
              const dayNotes = notes[dateKey] ?? [];
              const isToday = dateKey === todayKey;
              const isPast = dateKey < todayKey;
              const total = dayPosts.length + dayNotes.length;

              return (
                <DroppableDay key={dateKey} dateKey={dateKey} isToday={isToday} isPast={isPast}
                  onAddNote={() => { setAddingNoteDate(dateKey); setNoteInput(""); }}>
                  <div className={`text-xs font-bold mb-1 px-0.5 ${isToday ? "text-emerald-400" : isPast ? "text-gray-600" : "text-gray-300"}`}>
                    {dayNum}
                  </div>

                  {addingNoteDate === dateKey ? (
                    <div className="space-y-0.5">
                      <input
                        autoFocus
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addNote(dateKey);
                          if (e.key === "Escape") setAddingNoteDate(null);
                        }}
                        placeholder="Ex: Stories promocional"
                        className="w-full bg-zinc-800 border border-zinc-500 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:border-zinc-300 placeholder-zinc-500"
                      />
                      <div className="flex gap-0.5">
                        <button onClick={() => addNote(dateKey)} className="flex-1 text-xs py-0.5 bg-zinc-600 hover:bg-zinc-500 text-white rounded transition-colors">✓</button>
                        <button onClick={() => setAddingNoteDate(null)} className="flex-1 text-xs py-0.5 bg-zinc-800 text-zinc-400 rounded transition-colors">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 4).map((post) => (
                        <DraggablePost key={post.id} post={post} compact />
                      ))}
                      {dayNotes.map((note, idx) => (
                        <ManualNote key={idx} label={note} onRemove={() => removeNote(dateKey, idx)} />
                      ))}
                      {total > 4 && dayNotes.length === 0 && (
                        <div className="text-xs text-gray-500 px-1">+{total - 4} mais</div>
                      )}
                    </div>
                  )}
                </DroppableDay>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePost && (
          <div style={{ width: 180 }}>
            <PostCard post={activePost} compact />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
