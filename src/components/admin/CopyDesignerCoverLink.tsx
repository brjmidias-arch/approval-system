"use client";

import { useState } from "react";

/** Copia um link único do designer (por padrão, o de capas). */
export default function CopyDesignerCoverLink({
  token,
  path = "criar-capa",
  label = "🎨 Link designer (capas)",
  title = "Link com todos os vídeos que precisam de capa — envie para o designer",
  color = "pink",
}: {
  token: string;
  path?: string;
  label?: string;
  title?: string;
  color?: "pink" | "amber";
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}/${path}/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const cls = color === "amber"
    ? "bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border-amber-500/30"
    : "bg-pink-900/30 hover:bg-pink-900/50 text-pink-300 border-pink-500/30";

  return (
    <button onClick={copy} title={title} className={`text-sm px-3 py-2 rounded-lg border transition-colors ${cls}`}>
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
