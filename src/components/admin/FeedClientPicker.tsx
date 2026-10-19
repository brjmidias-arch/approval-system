"use client";

import { useRouter } from "next/navigation";

/** Seletor de cliente da prévia do feed (troca o ?client= da URL). */
export default function FeedClientPicker({ clients, current }: { clients: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/admin/feed?client=${e.target.value}`)}
      className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
    >
      {clients.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
