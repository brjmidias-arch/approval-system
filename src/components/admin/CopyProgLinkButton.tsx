"use client";

import { useState } from "react";

/**
 * Botão visível no card para copiar o link da programação do cliente
 * (`/programar/{clientId}`) e enviar a quem agenda os posts.
 */
export default function CopyProgLinkButton({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/programar/${clientId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-[10px] px-2 py-0.5 rounded bg-sky-900/30 hover:bg-sky-900/50 text-sky-300 border border-sky-500/30 transition-colors shrink-0"
    >
      {copied ? "Copiado!" : "🔗 Link p/ programar"}
    </button>
  );
}
