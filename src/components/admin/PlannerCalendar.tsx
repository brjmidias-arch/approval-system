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
  fileType: string;
  coverUrl: string | null;
  caption: string | null;
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

function PostPreviewModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const s = TYPE_STYLE[post.contentType] ?? DEFAULT_STYLE;
  const isVideo = post.fileType === "VIDEO";
  const thumb = post.coverUrl || (post.fileType === "IMAGE" ? post.fileUrl : (post.fileUrl.includes("thumbnail") ? post.fileUrl : null));

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.bg} ${s.text}`}>
              {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
            </span>
            <span className="text-white text-sm font-medium truncate">
              {post.title || post.campaignName}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors ml-2 shrink-0">×</button>
        </div>

        {/* Media */}
        {isVideo ? (
          <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 200 }}>
            {thumb
              ? <img src={thumb} alt="" className="w-full max-h-72 object-contain opacity-60" />
              : <div className="py-12 text-5xl">🎬</div>
            }
            <a
              href={post.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-colors">
                <span className="text-white text-2xl ml-1">▶</span>
              </div>
            </a>
          </div>
        ) : thumb ? (
          <img src={thumb} alt="" className="w-full max-h-72 object-contain bg-black" />
        ) : (
          <div className="py-12 text-center text-5xl bg-black/40">🖼️</div>
        )}

        {/* Info */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-gray-500">{post.clientName} · {post.campaignName}</p>
          {post.scheduledDate && (
            <p className="text-xs text-emerald-400">
              📅 {new Date(post.scheduledDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            </p>
          )}
          {post.caption && (
            <div className="border-t border-white/10 pt-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Legenda</p>
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{post.caption}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const s = TYPE_STYLE[post.contentType] ?? DEFAULT_STYLE;
  const thumb = post.coverUrl || (post.fileType === "IMAGE" ? post.fileUrl : (post.fileUrl.includes("thumbnail") ? post.fileUrl : null));

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

function DraggablePost({ post, compact, onPreview }: { post: Post; compact?: boolean; onPreview: (post: Post) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: "grab", touchAction: "none" }}
      onClick={(e) => { e.stopPropagation(); onPreview(post); }}
    >
      <PostCard post={post} compact={compact} />
    </div>
  );
}

const NOTE_COLORS = [
  { id: "zinc",   bg: "bg-zinc-700",   border: "border-zinc-500",   text: "text-zinc-100",   dot: "bg-zinc-400"   },
  { id: "yellow", bg: "bg-yellow-700", border: "border-yellow-500", text: "text-yellow-100", dot: "bg-yellow-400" },
  { id: "orange", bg: "bg-orange-700", border: "border-orange-500", text: "text-orange-100", dot: "bg-orange-400" },
  { id: "red",    bg: "bg-red-800",    border: "border-red-600",    text: "text-red-100",    dot: "bg-red-400"    },
  { id: "green",  bg: "bg-green-800",  border: "border-green-600",  text: "text-green-100",  dot: "bg-green-400"  },
  { id: "blue",   bg: "bg-blue-800",   border: "border-blue-600",   text: "text-blue-100",   dot: "bg-blue-400"   },
  { id: "purple", bg: "bg-purple-800", border: "border-purple-600", text: "text-purple-100", dot: "bg-purple-400" },
];

function getNoteStyle(colorId: string) {
  return NOTE_COLORS.find((c) => c.id === colorId) ?? NOTE_COLORS[0];
}

function ManualNote({ label, color, onRemove }: { label: string; color: string; onRemove: (e?: React.MouseEvent) => void }) {
  const s = getNoteStyle(color);
  return (
    <div className={`rounded border px-1.5 py-0.5 text-xs flex items-center gap-1 group ${s.bg} ${s.border} ${s.text}`}>
      <span className="truncate flex-1">{label}</span>
      <button onClick={(e) => { e.stopPropagation(); onRemove(e); }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all leading-none shrink-0">×</button>
    </div>
  );
}

function DraggableNote({ noteId, label, color, onRemove }: { noteId: string; label: string; color: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: noteId });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: "grab", touchAction: "none" }}>
      <ManualNote label={label} color={color} onRemove={(e?: React.MouseEvent) => { e?.stopPropagation(); onRemove(); }} />
    </div>
  );
}

function UnscheduledDropzone({ children, count }: { children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <div
      ref={setNodeRef}
      className={`bg-[#111] border rounded-xl p-3 flex-1 overflow-hidden flex flex-col transition-colors ${
        isOver ? "border-white/40 bg-white/5" : "border-white/10"
      }`}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Sem data ({count})
      </p>
      <div className="overflow-y-auto space-y-1.5 flex-1">
        {children}
      </div>
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

interface NoteEntry { label: string; color: string }
interface NoteMap { [dateKey: string]: NoteEntry[] }

export default function PlannerCalendar({ initialPosts, clientId, onDateChange }: {
  initialPosts: Post[];
  clientId?: string;
  onDateChange?: (postId: string, dateKey: string | null) => void;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [activeNote, setActiveNote] = useState<NoteEntry | null>(null);
  const [notes, setNotes] = useState<NoteMap>({});
  const [addingNoteDate, setAddingNoteDate] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [noteColor, setNoteColor] = useState("zinc");

  const storageKey = `planner_notes_${clientId ?? "default"}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, (string | NoteEntry)[]>;
        const normalized: NoteMap = {};
        for (const [k, v] of Object.entries(parsed)) {
          normalized[k] = v.map((n) => typeof n === "string" ? { label: n, color: "zinc" } : n);
        }
        setNotes(normalized);
      }
    } catch {}
  }, [storageKey]);

  function saveNotes(updated: NoteMap) {
    setNotes(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
  }

  function addNote(dateKey: string) {
    const label = noteInput.trim();
    if (!label) return;
    const updated = { ...notes, [dateKey]: [...(notes[dateKey] ?? []), { label, color: noteColor }] };
    saveNotes(updated);
    setNoteInput("");
    setNoteColor("zinc");
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
    const id = e.active.id as string;
    if (id.startsWith("note::")) {
      const [, dateKey, idxStr] = id.split("::");
      const entry = notes[dateKey]?.[Number(idxStr)];
      setActiveNote(entry ?? null);
    } else {
      setActivePost(posts.find((p) => p.id === id) ?? null);
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActivePost(null);
    setActiveNote(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // --- Note drag ---
    if (activeId.startsWith("note::")) {
      const [, srcDate, idxStr] = activeId.split("::");
      const srcIdx = Number(idxStr);
      if (overId === "unscheduled" || !/^\d{4}-\d{2}-\d{2}$/.test(overId)) return;
      if (overId === srcDate) return;
      const entry = notes[srcDate]?.[srcIdx];
      if (!entry) return;
      const srcList = [...(notes[srcDate] ?? [])];
      srcList.splice(srcIdx, 1);
      const dstList = [...(notes[overId] ?? []), entry];
      saveNotes({ ...notes, [srcDate]: srcList, [overId]: dstList });
      return;
    }

    // --- Post drag ---
    const post = posts.find((p) => p.id === activeId);
    if (!post) return;

    if (overId === "unscheduled") {
      if (!post.scheduledDate) return;
      const prevDate = post.scheduledDate;
      setPosts((prev) => prev.map((p) => p.id === activeId ? { ...p, scheduledDate: null } : p));
      onDateChange?.(activeId, null);
      try {
        const res = await fetch(`/api/admin/campaigns/${post.campaignId}/items/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledDate: null }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setPosts((cur) => cur.map((p) => p.id === activeId ? { ...p, scheduledDate: prevDate } : p));
        onDateChange?.(activeId, prevDate.slice(0, 10));
        alert("Erro ao remover data. Tente novamente.");
      }
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(overId)) return;
    if (post.scheduledDate?.slice(0, 10) === overId) return;
    const prevDate = post.scheduledDate;
    const [y, m, d] = overId.split("-").map(Number);
    const localDate = new Date(y, m - 1, d, 12, 0, 0);
    setPosts((prev) => prev.map((p) => p.id === activeId ? { ...p, scheduledDate: localDate.toISOString() } : p));
    onDateChange?.(activeId, overId);
    try {
      const res = await fetch(`/api/admin/campaigns/${post.campaignId}/items/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: overId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPosts((cur) => cur.map((p) => p.id === activeId ? { ...p, scheduledDate: prevDate } : p));
      onDateChange?.(activeId, prevDate ? prevDate.slice(0, 10) : null);
      alert("Erro ao salvar data. Tente novamente.");
    }
  }

  return (
    <>
      {previewPost && <PostPreviewModal post={previewPost} onClose={() => setPreviewPost(null)} />}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full">

          {/* Sidebar */}
          <div className="w-52 shrink-0 flex flex-col gap-2">
            <UnscheduledDropzone count={unscheduledPosts.length}>
              {unscheduledPosts.length === 0 && (
                <p className="text-xs text-gray-600 text-center mt-4">Todos os posts têm data</p>
              )}
              {unscheduledPosts.map((post) => (
                <DraggablePost key={post.id} post={post} onPreview={setPreviewPost} />
              ))}
            </UnscheduledDropzone>
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
                        <div className="flex gap-0.5 flex-wrap">
                          {NOTE_COLORS.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setNoteColor(c.id)}
                              className={`w-4 h-4 rounded-full ${c.dot} transition-all ${noteColor === c.id ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-900" : "opacity-60 hover:opacity-100"}`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-0.5">
                          <button onClick={() => addNote(dateKey)} className="flex-1 text-xs py-0.5 bg-zinc-600 hover:bg-zinc-500 text-white rounded transition-colors">✓</button>
                          <button onClick={() => { setAddingNoteDate(null); setNoteColor("zinc"); }} className="flex-1 text-xs py-0.5 bg-zinc-800 text-zinc-400 rounded transition-colors">✕</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {dayPosts.slice(0, 4).map((post) => (
                          <DraggablePost key={post.id} post={post} compact onPreview={setPreviewPost} />
                        ))}
                        {dayNotes.map((note, idx) => (
                          <DraggableNote key={idx} noteId={`note::${dateKey}::${idx}`} label={note.label} color={note.color} onRemove={() => removeNote(dateKey, idx)} />
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
          {activeNote && (
            <div style={{ width: 140 }}>
              <ManualNote label={activeNote.label} color={activeNote.color} onRemove={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
