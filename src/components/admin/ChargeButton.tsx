"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  campaignId: string;
  lastChargedAt: string | null;
  daysSinceOpen: number;
}

export default function ChargeButton({ campaignId, lastChargedAt, daysSinceOpen }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const todaySixAM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0);

  // Charged "this cycle" means after today's 6am reset
  const chargedThisCycle = lastChargedAt ? new Date(lastChargedAt) >= todaySixAM : false;

  const daysSinceCharged = lastChargedAt
    ? Math.floor((Date.now() - new Date(lastChargedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const neverCharged = lastChargedAt === null;

  async function handleCharge(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    await fetch(`/api/admin/campaigns/${campaignId}/charge`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  if (daysSinceOpen === 0 && neverCharged) {
    return <span className="text-xs text-gray-500">Aguardando cliente</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      {neverCharged && daysSinceOpen >= 1 && (
        <span className="text-xs text-red-400 font-medium">
          ⚠ não cobrado · sem aprovação há {daysSinceOpen} {daysSinceOpen === 1 ? "dia" : "dias"}
        </span>
      )}
      {!neverCharged && !chargedThisCycle && (
        <span className="text-xs text-amber-400">
          cobrado há {daysSinceCharged} {daysSinceCharged === 1 ? "dia" : "dias"} · sem aprovação há {daysSinceOpen} {daysSinceOpen === 1 ? "dia" : "dias"}
        </span>
      )}
      {chargedThisCycle && (
        <span className="text-xs text-gray-500">cobrado hoje</span>
      )}

      {!chargedThisCycle && (
        <button
          onClick={handleCharge}
          disabled={loading}
          className="text-xs px-2.5 py-1 rounded-lg bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 border border-orange-500/30 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "..." : "📣 Cobrar cliente"}
        </button>
      )}
    </div>
  );
}
