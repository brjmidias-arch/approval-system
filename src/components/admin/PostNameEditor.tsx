"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Nome do post editável inline. Mostra o rótulo atual; ao clicar, vira um
 * campo de texto que salva o `title` (Enter ou blur; Esc cancela).
 */
export default function PostNameEditor({
  postId,
  title,
  fallbackLabel,
  textClassName,
}: {
  postId: string;
  title: string | null;
  fallbackLabel: string;
  textClassName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    cancelRef.current = false;
    setValue(title ?? "");
    setEditing(true);
  }

  async function commit() {
    if (cancelRef.current) {
      setEditing(false);
      return;
    }
    const next = value.trim();
    if (next === (title ?? "").trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      alert("Erro ao renomear o post. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelRef.current = true;
            inputRef.current?.blur();
          }
        }}
        onBlur={commit}
        placeholder="Nome do post"
        className="w-full bg-[#0f0f0f] border border-emerald-500/50 rounded px-1 py-0.5 text-white text-xs outline-none focus:border-emerald-400"
      />
    );
  }

  return (
    <span
      onClick={startEditing}
      title="Clique para editar o nome"
      className={`block truncate cursor-text hover:underline decoration-dotted underline-offset-2 ${textClassName}`}
    >
      {fallbackLabel}
    </span>
  );
}
