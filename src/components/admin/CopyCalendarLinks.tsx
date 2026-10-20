"use client";

import { useState } from "react";
import { currentWeekKey, weekLabel, weekRelative } from "@/lib/weeks";
import { shortUrl } from "@/lib/shortLink";

function shiftWeek(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Copiar o link público do calendário do cliente: completo ou só de uma semana
 * (link curto /c/<código>?semana=YYYY-MM-DD).
 */
export default function CopyCalendarLinks({ token }: { token: string | null }) {
  const current = currentWeekKey();
  const weeks = [-1, 0, 1, 2, 3, 4].map((n) => shiftWeek(current, n));
  const [week, setWeek] = useState(weeks[1]);
  const [copied, setCopied] = useState<"all" | "week" | null>(null);
  if (!token) return null;

  function copy(which: "all" | "week") {
    const base = shortUrl(window.location.origin, "c", token!);
    navigator.clipboard.writeText(which === "all" ? base : `${base}?semana=${week}`);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  const btn = "text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors";
  return (
    <>
      <button type="button" onClick={() => copy("all")} className={btn}>
        {copied === "all" ? "✅ Link copiado!" : "📅 Copiar link do calendário"}
      </button>
      <div className="flex items-center rounded-lg bg-white/5 overflow-hidden">
        <select
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="bg-transparent text-sm text-gray-300 pl-3 pr-1 py-2 focus:outline-none"
          aria-label="Semana"
        >
          {weeks.map((w) => (
            <option key={w} value={w} className="bg-[#1a1a1a]">
              Semana {weekLabel(w)}{weekRelative(w, current) ? ` (${weekRelative(w, current)})` : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => copy("week")} className="text-sm px-3 py-2 text-gray-300 hover:bg-white/10 border-l border-white/10 transition-colors">
          {copied === "week" ? "✅ Copiado!" : "🔗 Copiar link da semana"}
        </button>
      </div>
    </>
  );
}
