import { createClient } from "@supabase/supabase-js";

// Acesso ao Supabase do sistema de Roteirização (projeto separado).
// SÓ SERVIDOR — usa a service role key; nunca importar em componente client.
const url = process.env.ROTEIRIZACAO_SUPABASE_URL;
const key = process.env.ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY;

function rot() {
  if (!url || !key) throw new Error("ROTEIRIZACAO_SUPABASE_URL/KEY não configurados");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type RotConteudo = {
  id: string;
  roteiro_id: string;
  tipo: string;
  titulo: string | null;
  legenda: string | null;
  status: string;
};

/** Lista os clientes do Roteirização (para vincular ao cliente do aprovação). */
export async function listClientesRot(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await rot().from("rot_clientes").select("id, nome").order("nome");
  if (error) throw error;
  return data ?? [];
}

const CONCLUIDO = new Set(["concluido", "concluído"]);
const naoConcluido = (status: string | null) => !CONCLUIDO.has((status ?? "").toLowerCase());

/**
 * Conteúdos (peças) de um cliente do Roteirização — via os roteiros dele.
 * Mostra só o que NÃO foi concluído (exclui roteiros e peças com status "concluido").
 */
export async function listConteudosDoCliente(rotClienteId: string): Promise<RotConteudo[]> {
  const client = rot();
  const { data: roteiros, error: e1 } = await client
    .from("rot_roteiros")
    .select("id, status")
    .eq("cliente_id", rotClienteId);
  if (e1) throw e1;
  const ids = (roteiros ?? []).filter((r) => naoConcluido(r.status)).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("rot_conteudos")
    .select("id, roteiro_id, tipo, titulo, legenda, status")
    .in("roteiro_id", ids)
    .order("ordem");
  if (error) throw error;
  return (data ?? []).filter((c) => naoConcluido(c.status));
}

/** Busca uma peça (para puxar título/legenda ao anexar). */
export async function getConteudo(id: string): Promise<RotConteudo | null> {
  const { data, error } = await rot()
    .from("rot_conteudos")
    .select("id, roteiro_id, tipo, titulo, legenda, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Atualiza o status de uma peça no Roteirização (só 'aprovado' ou 'ajuste'). */
export async function setConteudoStatus(id: string, status: "aprovado" | "ajuste"): Promise<void> {
  const { error } = await rot().from("rot_conteudos").update({ status }).eq("id", id);
  if (error) throw error;
}
