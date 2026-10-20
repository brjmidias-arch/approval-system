"use client";

import { useState } from "react";
import { shortUrl } from "@/lib/shortLink";

/** Copia o link público da prévia do feed do cliente (link curto /f/<código>). */
export default function CopyFeedLinkButton({ token, className }: { token: string | null; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!token) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(shortUrl(window.location.origin, "f", token));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={className ?? "text-sm px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"}
    >
      {copied ? "✅ Link copiado!" : "📱 Copiar link do feed"}
    </button>
  );
}
