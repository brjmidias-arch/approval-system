"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  campaignId: string;
  alreadySent: boolean;
}

export default function SentToProductionButton({ campaignId, alreadySent }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (alreadySent) return;
    setLoading(true);
    await fetch(`/api/admin/campaigns/${campaignId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentToProduction: true }),
    });
    setLoading(false);
    router.refresh();
  }

  if (alreadySent) {
    return (
      <span className="text-xs font-medium text-orange-400 bg-orange-900/20 border border-orange-500/20 px-2.5 py-1 rounded-lg">
        ✅ Enviado p/ Produção
      </span>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-xs px-2.5 py-1 rounded-lg bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 border border-orange-500/30 transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {loading ? "..." : "📤 Enviado para Produção"}
    </button>
  );
}
