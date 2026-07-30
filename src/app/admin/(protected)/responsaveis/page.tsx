"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { chave: string; nome: string };

const LABELS: Record<string, string> = {
  revisaoInterna: "Revisão interna",
  ajusteVideo: "Ajuste de vídeo / Reels",
  ajusteOutro: "Ajuste de post feed / carrossel / estático",
  criarCapa: "Criar capa",
  aprovarCapa: "Aprovar capa",
  prontoProgramar: "Pronto para programar",
};
const ORDEM = ["revisaoInterna", "ajusteVideo", "ajusteOutro", "criarCapa", "aprovarCapa", "prontoProgramar"];

export default function ResponsaveisPage() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/responsaveis")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        const ordenados = (d.itens as Item[]).sort((a, b) => ORDEM.indexOf(a.chave) - ORDEM.indexOf(b.chave));
        setItens(ordenados);
      })
      .catch(() => setErro("Erro ao carregar."));
  }, []);

  function setNome(chave: string, nome: string) {
    setItens((prev) => (prev ? prev.map((i) => (i.chave === chave ? { ...i, nome } : i)) : prev));
  }

  async function salvar() {
    if (!itens) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/responsaveis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin" className="hover:text-white">Dashboard</Link>
          <span>/</span>
          <span className="text-white">Responsáveis (Roteirização)</span>
        </div>
        <h1 className="text-xl font-semibold text-white mt-1">Responsáveis por fase</h1>
        <p className="text-gray-400 text-sm mt-1">
          Quando um post anexado muda de fase, este nome é gravado como <b>Responsável</b> do roteiro no Roteirização.
        </p>
      </div>

      {erro ? (
        <p className="text-amber-400 text-sm">{erro}</p>
      ) : itens === null ? (
        <p className="text-gray-500 text-sm">Carregando…</p>
      ) : (
        <>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 space-y-3">
            {itens.map((i) => (
              <div key={i.chave}>
                <label className="block text-xs text-gray-400 mb-1">{LABELS[i.chave] ?? i.chave}</label>
                <input
                  value={i.nome}
                  onChange={(e) => setNome(i.chave, e.target.value)}
                  placeholder="Nome do responsável"
                  className="w-full bg-[#0f0f0f] border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={salvar}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {busy ? "Salvando…" : saved ? "Salvo ✓" : "Salvar"}
          </button>
          <p className="text-[11px] text-gray-600">
            Use exatamente o nome como aparece no Roteirização (ex.: &quot;Gabriela Campos&quot;, &quot;Júnior&quot;, &quot;Bruno&quot;) para
            que o filtro por responsável funcione lá.
          </p>
        </>
      )}
    </div>
  );
}
