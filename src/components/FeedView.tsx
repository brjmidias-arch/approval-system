"use client";

import { useState, useMemo } from "react";
import type { FeedEntry, FeedStatus } from "@/lib/feed";

type Period = "month" | "next30" | "nextMonth" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "Este mês" },
  { id: "next30", label: "Próx. 30 dias" },
  { id: "nextMonth", label: "Mês que vem" },
  { id: "all", label: "Tudo" },
];

const STATUS: Record<FeedStatus, { label: string; dot: string; chip: string }> = {
  approved: { label: "Aprovado", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-300" },
  pending: { label: "Aguardando aprovação", dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-300" },
  adjustment: { label: "Em ajuste", dot: "bg-orange-400", chip: "bg-orange-500/15 text-orange-300" },
  rejected: { label: "Reprovado", dot: "bg-red-500", chip: "bg-red-500/15 text-red-300" },
  published: { label: "Publicado", dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-300" },
  internal: { label: "Revisão interna", dot: "bg-violet-400", chip: "bg-violet-500/15 text-violet-300" },
  draft: { label: "Rascunho", dot: "bg-gray-400", chip: "bg-white/10 text-gray-300" },
};

const TYPE_LABEL: Record<string, string> = {
  REELS: "Reels", CARROSSEL: "Carrossel", POST_FEED: "Arte", STORIES: "Stories", DOCUMENTO: "Documento",
};

/** "YYYY-MM-DD" de hoje no fuso de São Paulo. */
function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function inPeriod(dateIso: string, p: Period): boolean {
  const day = dateIso.slice(0, 10); // gravado ao meio-dia UTC → a parte UTC é o dia certo
  const today = todayKey();
  if (p === "all") return true;
  if (p === "month") return day.slice(0, 7) === today.slice(0, 7);
  if (p === "next30") return day >= today && day <= addDays(today, 30);
  const [y, m] = today.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return day.slice(0, 7) === next;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
}

function CarouselIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow" fill="white" aria-label="Carrossel">
      <path d="M8 3h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M4 7v12a2 2 0 0 0 2 2h12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ReelsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow" fill="white" aria-label="Reels">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function Tile({ e, showStatus, onOpen }: { e: FeedEntry; showStatus: boolean; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const st = STATUS[e.status];
  const hasImg = !!e.thumb && !broken;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative aspect-[3/4] overflow-hidden bg-[#262626] focus:outline-none ${
        showStatus && e.status !== "approved" && e.status !== "published" ? "ring-1 ring-inset ring-white/25" : ""
      }`}
    >
      {hasImg ? (
        <img src={e.thumb!} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
          <span className="text-lg">{e.isVideo ? "🎬" : "🖼️"}</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">{e.isVideo ? "Vídeo" : "Arte"}</span>
          {e.title && <span className="text-[11px] leading-tight text-gray-200 line-clamp-3">{e.title}</span>}
        </div>
      )}
      <span className="absolute top-1.5 right-1.5">
        {e.contentType === "CARROSSEL" && e.slides.length > 1 ? <CarouselIcon /> : e.isVideo ? <ReelsIcon /> : null}
      </span>
      {showStatus && (
        <span
          title={st.label}
          className={`absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-black/60 ${st.dot}`}
        />
      )}
    </button>
  );
}

function PostModal({
  e, onClose, onGoApprove,
}: { e: FeedEntry; onClose: () => void; onGoApprove?: (key: string) => void }) {
  const [i, setI] = useState(0);
  const s = e.slides[i];
  const st = STATUS[e.status];
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#141414] border border-white/10 w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.chip}`}>{st.label}</span>
          <span className="text-xs text-gray-400">{fmtDate(e.scheduledDate)} · {TYPE_LABEL[e.contentType] ?? e.contentType}</span>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white text-xl leading-none" aria-label="Fechar">×</button>
        </div>

        <div className="relative bg-black aspect-[4/5]">
          {s?.img ? (
            <img src={s.img} alt="" className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Sem prévia</div>
          )}
          {s?.isVideo && s.openUrl && (
            <a href={s.openUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
              <span className="w-14 h-14 rounded-full bg-white/25 backdrop-blur flex items-center justify-center text-white text-2xl pl-1">▶</span>
              <span className="text-white/90 text-sm">Assistir vídeo no Drive</span>
            </a>
          )}
          {e.slides.length > 1 && (
            <>
              <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white disabled:opacity-20">‹</button>
              <button onClick={() => setI((v) => Math.min(e.slides.length - 1, v + 1))} disabled={i === e.slides.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white disabled:opacity-20">›</button>
              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                {e.slides.map((_, si) => (
                  <span key={si} className={`w-1.5 h-1.5 rounded-full ${si === i ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-4 space-y-3">
          {e.caption?.trim() ? (
            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{e.caption}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">Sem legenda</p>
          )}
          {e.status === "pending" && onGoApprove && (
            <button
              onClick={() => onGoApprove(e.key)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Ir para aprovação →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Prévia do feed do Instagram (grade 3 colunas, tiles 3:4, mais futuro no topo à
 * esquerda). Só visualização: não altera nenhum status.
 */
export default function FeedView({
  entries,
  profileName,
  onGoApprove,
  defaultPeriod = "month",
}: {
  entries: FeedEntry[];
  profileName: string;
  onGoApprove?: (key: string) => void;
  defaultPeriod?: Period;
}) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [showStatus, setShowStatus] = useState(true);
  const [open, setOpen] = useState<FeedEntry | null>(null);

  const dated = useMemo(() => entries.filter((e) => e.scheduledDate), [entries]);
  const visible = useMemo(() => dated.filter((e) => inPeriod(e.scheduledDate!, period)), [dated, period]);
  const noDate = entries.length - dated.length;
  const usedStatuses = Array.from(new Set(visible.map((e) => e.status)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              period === p.id ? "bg-white text-black border-white" : "border-white/15 text-gray-300 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={showStatus} onChange={(ev) => setShowStatus(ev.target.checked)} className="accent-emerald-500" />
          Status
        </label>
      </div>

      {/* "Perfil" + grade, com a largura de um celular */}
      <div className="mx-auto w-full max-w-[470px] bg-black rounded-xl overflow-hidden border border-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 p-[2px] shrink-0">
            <div className="w-full h-full rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-semibold">
              {profileName.trim().charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{profileName}</p>
            <p className="text-gray-400 text-xs">Prévia do feed · {visible.length} {visible.length === 1 ? "post" : "posts"}</p>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-16 border-t border-white/10">Nenhum post com data neste período.</p>
        ) : (
          <div className="grid grid-cols-3 gap-[2px] border-t border-white/10">
            {visible.map((e) => (
              <Tile key={e.key} e={e} showStatus={showStatus} onOpen={() => setOpen(e)} />
            ))}
          </div>
        )}
      </div>

      {showStatus && usedStatuses.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
          {usedStatuses.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${STATUS[s].dot}`} /> {STATUS[s].label}
            </span>
          ))}
        </div>
      )}
      {noDate > 0 && (
        <p className="text-center text-[11px] text-gray-500">
          {noDate} {noDate === 1 ? "post sem data de publicação não aparece" : "posts sem data de publicação não aparecem"} na grade.
        </p>
      )}

      {open && (
        <PostModal
          e={open}
          onClose={() => setOpen(null)}
          onGoApprove={onGoApprove ? (k) => { setOpen(null); onGoApprove(k); } : undefined}
        />
      )}
    </div>
  );
}
