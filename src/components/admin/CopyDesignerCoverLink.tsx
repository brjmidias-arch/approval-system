"use client";

import { useState } from "react";

/** Copia o link único do designer (todos os posts que precisam de capa). */
export default function CopyDesignerCoverLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}/criar-capa/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={copy}
      className="text-sm px-3 py-2 rounded-lg bg-pink-900/30 hover:bg-pink-900/50 text-pink-300 border border-pink-500/30 transition-colors"
      title="Link com todos os vídeos que precisam de capa — envie para o designer"
    >
      {copied ? "Copiado ✓" : "🎨 Link designer (capas)"}
    </button>
  );
}
