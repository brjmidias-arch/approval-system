"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ClientCalendar, { type CalendarEntry } from "@/components/ClientCalendar";
import { PostModal } from "@/components/FeedView";
import type { FeedEntry } from "@/lib/feed";
import { weekKey, weekLabel, currentWeekKey } from "@/lib/weeks";

/** Status do feed → selo do calendário. */
const STATE: Record<FeedEntry["status"], CalendarEntry["state"]> = {
  pending: "pending", approved: "approved", published: "published",
  adjustment: "adjustment", rejected: "adjustment", internal: "adjustment", draft: "adjustment",
};

function toCalendar(e: FeedEntry): CalendarEntry {
  return {
    key: e.key,
    contentType: e.contentType as CalendarEntry["contentType"],
    fileType: "IMAGE",
    fileUrl: e.thumb ?? "",
    coverUrl: e.thumb,
    caption: e.caption,
    scheduledDate: e.scheduledDate,
    slides: e.slides.length,
    state: STATE[e.status],
  };
}

/**
 * Link público só do calendário de postagens (mesmo token do link de aprovação).
 * Com ?semana=YYYY-MM-DD mostra apenas aquela semana. Tocar num post abre o conteúdo.
 */
function CalendarContent() {
  const { token } = useParams<{ token: string }>();
  const params = useSearchParams();
  const semanaParam = params.get("semana");
  const semana = semanaParam && /^\d{4}-\d{2}-\d{2}$/.test(semanaParam) ? weekKey(semanaParam) : null;

  const [data, setData] = useState<{ name: string; entries: FeedEntry[] } | null>(null);
  const [error, setError] = useState<"not_found" | "error" | null>(null);
  const [open, setOpen] = useState<FeedEntry | null>(null);

  useEffect(() => {
    fetch(`/api/approval/${token}/feed`)
      .then(async (r) => {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error("error");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error && e.message === "not_found" ? "not_found" : "error"));
  }, [token]);

  const entries = useMemo(() => {
    if (!data) return [];
    // Calendário completo: da semana passada em diante (+ pendentes de qualquer data).
    const lastWeek = (() => {
      const d = new Date(`${currentWeekKey()}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString().slice(0, 10);
    })();
    return data.entries.filter((e) => {
      const wk = weekKey(e.scheduledDate);
      if (semana) return wk === semana;
      return e.status === "pending" || (e.scheduledDate !== null && wk >= lastWeek);
    });
  }, [data, semana]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-3">{error === "not_found" ? "🔒" : "⚠️"}</p>
          <p className="text-white font-medium">{error === "not_found" ? "Link inválido" : "Não foi possível carregar o calendário"}</p>
          <p className="text-gray-500 text-sm mt-1">{error === "not_found" ? "Este link não existe ou foi removido." : "Tente novamente em instantes."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div>
          <p className="text-gray-500 text-xs">{data?.name ?? ""}</p>
          <h1 className="text-white text-lg font-semibold">
            📅 {semana ? `Calendário · semana de ${weekLabel(semana)}` : "Calendário de postagens"}
          </h1>
        </div>
        {!data ? (
          <p className="text-gray-500 text-sm text-center py-16">Carregando…</p>
        ) : (
          <ClientCalendar
            entries={entries.map(toCalendar)}
            onOpenPending={() => {}}
            onOpenAny={(key) => setOpen(data.entries.find((e) => e.key === key) ?? null)}
          />
        )}
        {semana && (
          <p className="text-center">
            <a href={`/calendario/${token}`} className="text-xs text-gray-500 hover:text-gray-300">Ver o calendário completo</a>
          </p>
        )}
      </main>
      <footer className="text-center py-8 text-gray-700 text-xs">BRJ Mídias · Calendário de postagens</footer>

      {open && (
        <PostModal
          e={open}
          onClose={() => setOpen(null)}
          onGoApprove={() => { window.location.href = `/aprovar/${token}`; }}
        />
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f0f]" />}>
      <CalendarContent />
    </Suspense>
  );
}
