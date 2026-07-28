"use client";

import { useCallback, useEffect, useState } from "react";
import RoteiroClientLink from "@/components/admin/RoteiroClientLink";

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
 * Se o cliente ainda não estiver vinculado ao Roteirização e `clientName` for
 * informado, mostra o vínculo do cliente inline (não precisa ir ao topo da página).
 */
export default function AnexarRoteiroPicker({
  clientId,
  clientName,
  current,
  onPick,
}: {
  clientId: string;
  clientName?: string;
  current: string;
  onPick: (c: RotConteudoOpcao | null) => void;
}) {
  const [list, setList] = useState<RotConteudoOpcao[] | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(() => {
    setErro(null);
    fetch(`/api/admin/roteirizacao/conteudos?clientId=${clientId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (d.notLinked) { setNotLinked(true); setList(null); return; }
        setNotLinked(false);
        setList(d.conteudos ?? []);
      })
      .catch(() => setErro("Roteirização indisponível."));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  // Se o cliente for vinculado em outro picker/bloco, recarrega aqui também.
  useEffect(() => {
    function onLinked(e: Event) {
      const detail = (e as CustomEvent).detail as { clientId?: string } | undefined;
      if (!detail?.clientId || detail.clientId === clientId) load();
    }
    window.addEventListener("roteiro-client-linked", onLinked);
    return () => window.removeEventListener("roteiro-client-linked", onLinked);
  }, [clientId, load]);

  if (notLinked) {
    if (clientName) {
      return (
        <div className="space-y-1">
          <RoteiroClientLink
            clientId={clientId}
            clientName={clientName}
            current={null}
            onSaved={() => load()}
          />
          <p className="text-[11px] text-gray-600">Vincule o cliente acima para então escolher o roteiro.</p>
        </div>
      );
    }
    return <p className="text-xs text-amber-400">Vincule este cliente ao Roteirização primeiro (bloco no topo da página).</p>;
  }
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
