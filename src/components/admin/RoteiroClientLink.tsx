"use client";

import { useEffect, useState } from "react";

type RotCliente = { id: string; nome: string };

/**
 * Vincula o cliente do aprovação a um cliente do sistema de Roteirização
 * (grava Client.roteiroClienteId). Sugere pelo nome; salva via PUT.
 */
export default function RoteiroClientLink({
  clientId,
  clientName,
  current,
}: {
  clientId: string;
  clientName: string;
  current: string | null;
}) {
  const [clientes, setClientes] = useState<RotCliente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(current ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/roteirizacao/clientes")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        const list: RotCliente[] = data.clientes ?? [];
        setClientes(list);
        // Sugestão por nome, só se ainda não houver vínculo.
        if (!current) {
          const match = list.find((c) => c.nome.trim().toLowerCase() === clientName.trim().toLowerCase());
          if (match) setSelected(match.id);
        }
      })
      .catch(() => setErro("Roteirização indisponível no momento."));
  }, [clientName, current]);

  async function salvar() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roteiroClienteId: selected || null }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Erro ao salvar o vínculo. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3">
      <p className="text-xs font-medium text-gray-300 mb-2">🔗 Vínculo com o Roteirização</p>
      {erro ? (
        <p className="text-xs text-amber-400">{erro}</p>
      ) : clientes === null ? (
        <p className="text-xs text-gray-500">Carregando clientes do Roteirização…</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
            className="bg-[#0f0f0f] border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-emerald-500 max-w-[220px]"
          >
            <option value="">— Não vinculado —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <button
            onClick={salvar}
            disabled={busy || selected === (current ?? "")}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {busy ? "..." : saved ? "Salvo ✓" : "Salvar vínculo"}
          </button>
        </div>
      )}
    </div>
  );
}
