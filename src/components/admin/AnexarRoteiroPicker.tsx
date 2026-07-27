"use client";

import { useEffect, useState } from "react";

export type RotConteudoOpcao = {
  id: string;
  tipo: string;
  titulo: string | null;
  legenda: string | null;
  status: string;
};

/**
 * Seletor de peça do Roteirização para anexar a um post.
 * Ao escolher, chama onPick com a peça (ou null para desanexar).
 */
export default function AnexarRoteiroPicker({
  clientId,
  current,
  onPick,
}: {
  clientId: string;
  current: string;
  onPick: (c: RotConteudoOpcao | null) => void;
}) {
  const [list, setList] = useState<RotConteudoOpcao[] | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/roteirizacao/conteudos?clientId=${clientId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (d.notLinked) { setNotLinked(true); return; }
        setList(d.conteudos ?? []);
      })
      .catch(() => setErro("Roteirização indisponível."));
  }, [clientId]);

  if (notLinked)
    return <p className="text-xs text-amber-400">Vincule este cliente ao Roteirização primeiro (bloco no topo da página).</p>;
  if (erro) return <p className="text-xs text-amber-400">{erro}</p>;
  if (list === null) return <p className="text-xs text-gray-500">Carregando roteiros…</p>;

  return (
    <select
      value={current}
      onChange={(e) => onPick(list.find((x) => x.id === e.target.value) ?? null)}
      className="w-full bg-[#0f0f0f] border border-white/15 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-emerald-500"
    >
      <option value="">— Nenhum roteiro anexado —</option>
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {(c.titulo ?? "(sem título)")} · {c.tipo} · {c.status}
        </option>
      ))}
    </select>
  );
}
