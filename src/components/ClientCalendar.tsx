"use client";

import { CONTENT_TYPE_LABELS } from "@/types";
import type { ContentType } from "@/types";
import { NO_DATE, weekKey, weekDays, weekLabel, weekRelative, dayKey, dayLabel, compareWeekKeys, currentWeekKey } from "@/lib/weeks";

export type CalendarEntry = {
  key: string;
  contentType: ContentType;
  fileType: string;
  fileUrl: string;
  coverUrl: string | null;
  caption: string | null;
  scheduledDate: string | null;
  slides: number;
  state: "pending" | "approved" | "adjustment" | "published";
};

const STATE_BADGE: Record<CalendarEntry["state"], { label: string; cls: string }> = {
  pending: { label: "⏳ Aguardando você", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  approved: { label: "✅ Aprovado", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  adjustment: { label: "✏️ Em ajuste", cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  published: { label: "📣 Publicado", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
};

function Thumb({ e }: { e: CalendarEntry }) {
  const src = e.coverUrl || (e.fileType === "IMAGE" ? e.fileUrl : null);
  return (
    <div className="relative w-12 h-12 md:w-full md:h-auto md:aspect-[4/5] rounded-md overflow-hidden bg-black/50 shrink-0 flex items-center justify-center">
      {src ? <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-xl">🎬</span>}
      {e.slides > 1 && (
        <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">{e.slides}</span>
      )}
    </div>
  );
}

function PostChip({ e, onOpen, onOpenAny }: { e: CalendarEntry; onOpen: (key: string) => void; onOpenAny?: (key: string) => void }) {
  const b = STATE_BADGE[e.state];
  const clickable = e.state === "pending";
  const body = (
    <>
      <Thumb e={e} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs text-gray-200 truncate">
          {e.contentType === "CARROSSEL" ? `Carrossel · ${e.slides} slides` : CONTENT_TYPE_LABELS[e.contentType]}
        </p>
        {e.caption && <p className="text-[11px] text-gray-500 truncate md:hidden">{e.caption}</p>}
        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border ${b.cls}`}>{b.label}</span>
      </div>
    </>
  );
  const cls = "w-full flex md:flex-col gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]";
  // Abrir qualquer post (link do calendário): clicável, mas sem nenhum indicativo visual.
  if (onOpenAny) {
    return (
      <div role="button" tabIndex={0} onClick={() => onOpenAny(e.key)} onKeyDown={(ev) => ev.key === "Enter" && onOpenAny(e.key)} className={`${cls} cursor-default`}>
        {body}
      </div>
    );
  }
  return clickable ? (
    <button type="button" onClick={() => onOpen(e.key)} className={`${cls} hover:border-amber-500/40 transition-colors`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Calendário de postagens do cliente, separado por semana (segunda a domingo).
 * No celular vira uma lista dos dias com post; no computador, uma grade de 7 dias.
 * Tocar num post pendente abre ele para aprovar.
 */
export default function ClientCalendar({
  entries,
  onOpenPending,
  onOpenAny,
}: {
  entries: CalendarEntry[];
  onOpenPending: (key: string) => void;
  onOpenAny?: (key: string) => void;
}) {
  const current = currentWeekKey();
  const byWeek = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const wk = weekKey(e.scheduledDate);
    byWeek.set(wk, [...(byWeek.get(wk) ?? []), e]);
  }
  const weeks = Array.from(byWeek.keys()).sort(compareWeekKeys);

  if (weeks.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-10">Nenhum post no calendário ainda.</p>;
  }

  return (
    <div className="space-y-6">
      {weeks.map((wk) => {
        const list = byWeek.get(wk)!;
        const pend = list.filter((e) => e.state === "pending").length;
        const ok = list.filter((e) => e.state === "approved" || e.state === "published").length;
        const rel = weekRelative(wk, current);
        return (
          <section key={wk} className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 flex-wrap">
              <h3 className="text-white text-sm font-semibold">
                {wk === NO_DATE ? "📭 Sem data definida" : `📅 Semana ${weekLabel(wk)}`}
              </h3>
              {rel && <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">{rel}</span>}
              <span className="ml-auto text-[11px] text-gray-400">
                {ok > 0 && <span className="text-emerald-400">✅ {ok}</span>}
                {ok > 0 && pend > 0 && " · "}
                {pend > 0 && <span className="text-amber-300">⏳ {pend} p/ aprovar</span>}
              </span>
            </div>

            {wk === NO_DATE ? (
              <div className="p-3 grid gap-2 md:grid-cols-4">
                {list.map((e) => <PostChip key={e.key} e={e} onOpen={onOpenPending} onOpenAny={onOpenAny} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-7 md:divide-x divide-white/[0.06]">
                {weekDays(wk).map((day) => {
                  const posts = list.filter((e) => e.scheduledDate && dayKey(e.scheduledDate) === day);
                  const { dow, date } = dayLabel(day);
                  return (
                    <div
                      key={day}
                      className={`${posts.length === 0 ? "hidden md:block" : "flex md:block"} gap-3 px-3 py-2.5 md:p-2 border-b md:border-b-0 border-white/[0.06] last:border-b-0`}
                    >
                      <div className="w-12 shrink-0 md:w-auto md:mb-2">
                        <p className="text-[11px] text-gray-500 uppercase">{dow}</p>
                        <p className="text-sm text-gray-300 font-medium">{date}</p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {posts.map((e) => <PostChip key={e.key} e={e} onOpen={onOpenPending} onOpenAny={onOpenAny} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
