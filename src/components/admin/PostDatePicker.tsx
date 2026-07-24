"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Seletor de data inline do post. Grava `scheduledDate` (formato YYYY-MM-DD;
 * vazio limpa). Usado nos cards "Prontos p/ programar" e "Posts programados".
 */
export default function PostDatePicker({ postId, value }: { postId: string; value: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function save(dateStr: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: dateStr || null }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Erro ao definir a data. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <input
      type="date"
      value={value ?? ""}
      disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => save(e.target.value)}
      title="Definir o dia da programação"
      className="bg-[#0f0f0f] border border-sky-500/40 rounded px-1.5 py-0.5 text-[10px] text-sky-300 outline-none focus:border-sky-400 disabled:opacity-50 [color-scheme:dark]"
    />
  );
}
