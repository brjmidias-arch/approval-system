"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Data do post em modo inline-edit: mostra "📅 Programado para DD/MM" como
 * texto (ou "Definir data" se vazio); só vira campo de data ao clicar.
 * Grava `scheduledDate` (vazio limpa).
 */
export default function PostDatePicker({
  postId,
  value,
  label,
  done,
}: {
  postId: string;
  value: string | null; // YYYY-MM-DD (valor do input)
  label: string | null; // DD/MM (texto exibido)
  done?: boolean; // true = já agendado ("Programado para", verde); false = plano ("Programar para", azul)
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      try {
        (ref.current as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        /* showPicker pode não ser suportado — o foco já basta */
      }
    }
  }, [editing]);

  async function save(dateStr: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: dateStr || null }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      alert("Erro ao definir a data. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="date"
        defaultValue={value ?? ""}
        disabled={busy}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => save(e.target.value)}
        onBlur={() => setEditing(false)}
        className="bg-[#0f0f0f] border border-sky-500/50 rounded px-1 py-0.5 text-[10px] text-sky-300 outline-none [color-scheme:dark]"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditing(true);
      }}
      title="Clique para definir/alterar o dia"
      className={`text-[10px] transition-colors disabled:opacity-50 ${
        label
          ? done
            ? "text-emerald-400 hover:text-emerald-300 font-medium"
            : "text-sky-400 hover:text-sky-300"
          : "text-gray-400 border border-dashed border-white/20 rounded px-1.5 py-0.5 hover:text-white hover:border-white/40"
      }`}
    >
      {busy ? "..." : label ? `📅 ${done ? "Programado" : "Programar"} para ${label}` : "📅 Definir data"}
    </button>
  );
}
