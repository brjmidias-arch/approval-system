"use client";

import { useState, useEffect, useCallback } from "react";
import { NO_DATE } from "@/lib/weeks";
import { shortUrl } from "@/lib/shortLink";

type WeekRow = { week: string; label: string; relative: string | null; count: number };

/** Mensagem do WhatsApp para o cliente com o período da semana enviada. */
export function weekClientMsg(link: string, label: string, week: string): string {
  const head =
    week === NO_DATE
      ? "Temos novos conteúdos prontos para a sua aprovação."
      : `Os conteúdos da *semana de ${label}* estão prontos para a sua aprovação.`;
  return `Olá! 😊 ${head}\n\nÉ rápido: abra o link, veja cada post e toque em *Aprovar* ✅ ou peça um *Ajuste* ✏️.\n\n👉 ${link}`;
}

/**
 * Envio por semana: lista as semanas com posts "Pronto p/ cliente" e envia cada
 * uma de uma vez (copiando a mensagem do WhatsApp com o período). Com `showMode`,
 * também mostra a configuração do cliente (envio automático x por semana).
 */
export default function SendWeekPanel({
  clientId,
  clientToken,
  approvalMode,
  showMode = false,
  onChanged,
}: {
  clientId: string;
  clientToken?: string | null;
  approvalMode?: string;
  showMode?: boolean;
  onChanged?: () => void;
}) {
  const [weeks, setWeeks] = useState<WeekRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState(approvalMode ?? "AUTO");

  useEffect(() => setMode(approvalMode ?? "AUTO"), [approvalMode]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/send-week`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWeeks(data.weeks ?? []);
    } catch {
      setWeeks([]);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function changeMode(next: "AUTO" | "WEEKLY") {
    if (next === mode || busy) return;
    setBusy("mode");
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalMode: next }),
      });
      if (!res.ok) throw new Error();
      setMode(next);
      onChanged?.();
    } catch {
      alert("Erro ao salvar a configuração. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  async function sendWeek(w: WeekRow) {
    if (busy) return;
    const nome = w.week === NO_DATE ? "os posts sem data" : `a semana de ${w.label}`;
    if (!confirm(`Enviar ${nome} para o cliente (${w.count} ${w.count === 1 ? "post" : "posts"})?`)) return;
    setBusy(w.week);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/send-week`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: w.week }),
      });
      if (!res.ok) throw new Error();
      if (clientToken) {
        const link = shortUrl(window.location.origin, "a", clientToken);
        try { await navigator.clipboard.writeText(weekClientMsg(link, w.label, w.week)); } catch { /* sem clipboard */ }
        alert("Semana enviada! A mensagem com o link já foi copiada — cole no WhatsApp do cliente.");
      } else {
        alert("Semana enviada para o cliente!");
      }
      await load();
      onChanged?.();
    } catch {
      alert("Erro ao enviar a semana. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {showMode && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Envio para aprovação do cliente</p>
          <div className="flex bg-white/5 rounded-lg p-0.5 w-fit">
            {([
              { v: "AUTO", label: "⚡ Automático" },
              { v: "WEEKLY", label: "📅 Por semana" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                disabled={busy === "mode"}
                onClick={() => changeMode(o.v)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-60 ${
                  mode === o.v ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-1.5">
            {mode === "WEEKLY"
              ? "Aprovado na revisão interna fica em “Pronto p/ cliente” até você enviar a semana."
              : "Aprovado na revisão interna vai direto para o link do cliente."}
          </p>
        </div>
      )}

      {weeks === null ? (
        <p className="text-xs text-gray-500">Carregando…</p>
      ) : weeks.length === 0 ? (
        showMode && mode === "WEEKLY" ? <p className="text-xs text-gray-500">Nenhum post pronto para enviar.</p> : null
      ) : (
        <div className="space-y-1.5">
          {weeks.map((w) => (
            <div key={w.week} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {w.week === NO_DATE ? "📭 Sem data definida" : `📅 Semana ${w.label}`}
                  {w.relative && <span className="ml-2 text-[11px] text-sky-400">{w.relative}</span>}
                </p>
                <p className="text-[11px] text-gray-500">
                  {w.count} {w.count === 1 ? "post pronto" : "posts prontos"}
                </p>
              </div>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => sendWeek(w)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
              >
                {busy === w.week ? "Enviando…" : "📤 Enviar p/ cliente"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
