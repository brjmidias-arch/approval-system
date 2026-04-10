"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      {copied ? "✅ Copiado!" : "Copiar legenda"}
    </button>
  );
}
