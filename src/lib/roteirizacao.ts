import { createClient } from "@supabase/supabase-js";

// Acesso ao Supabase do sistema de Roteirização (projeto separado).
// SÓ SERVIDOR — usa a service role key; nunca importar em componente client.
const url = process.env.ROTEIRIZACAO_SUPABASE_URL;
const key = process.env.ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY;

function rot() {
  if (!url || !key) throw new Error("ROTEIRIZACAO_SUPABASE_URL/KEY não configurados");
  return createClient(url, key, { auth: { persistSession: false } });
}

// O roteiro/post é uma linha em rot_scripts (cliente_id direto).
// `status` aqui = script_tarefa (fase de produção do Roteirização).
export type RotConteudo = {
  id: string;
  tipo: string | null;
  titulo: string | null;
  legenda: string | null;
  status: string | null;
  data_postagem: string | null;
};

const CONCLUIDO = new Set(["concluido", "concluído"]);
const naoConcluido = (tarefa: string | null) => !CONCLUIDO.has((tarefa ?? "").toLowerCase());

function toConteudo(s: {
  id: string;
  tipo: string | null;
  titulo: string | null;
  legenda: string | null;
  script_tarefa: string | null;
  data_postagem?: string | null;
}): RotConteudo {
  return { id: s.id, tipo: s.tipo, titulo: s.titulo, legenda: s.legenda, status: s.script_tarefa, data_postagem: s.data_postagem ?? null };
}

/** Lista os clientes do Roteirização (para vincular ao cliente do aprovação). */
export async function listClientesRot(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await rot().from("rot_clientes").select("id, nome").order("nome");
  if (error) throw error;
  return data ?? [];
}

/**
 * Roteiros (rot_scripts) de um cliente do Roteirização.
 * Mostra só os que NÃO estão concluídos (script_tarefa != "Concluído").
 */
export async function listConteudosDoCliente(rotClienteId: string): Promise<RotConteudo[]> {
  const { data, error } = await rot()
    .from("rot_scripts")
    .select("id, tipo, titulo, legenda, script_tarefa, mes_ano")
    .eq("cliente_id", rotClienteId)
    .order("mes_ano", { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((s) => naoConcluido(s.script_tarefa)).map(toConteudo);
}

/** Data de previsão (data_postagem) de vários roteiros de uma vez: { rotScriptId: "YYYY-MM-DD"|null }. */
export async function getDataPostagemByIds(ids: string[]): Promise<Record<string, string | null>> {
  const uniq = Array.from(new Set(ids));
  if (uniq.length === 0) return {};
  const { data, error } = await rot().from("rot_scripts").select("id, data_postagem").in("id", uniq);
  if (error) throw error;
  const map: Record<string, string | null> = {};
  for (const r of data ?? []) map[r.id] = r.data_postagem ?? null;
  return map;
}

/** Busca um roteiro (para puxar título/legenda ao anexar). */
export async function getConteudo(id: string): Promise<RotConteudo | null> {
  const { data, error } = await rot()
    .from("rot_scripts")
    .select("id, tipo, titulo, legenda, script_tarefa, data_postagem")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toConteudo(data) : null;
}

/**
 * Atualiza campos do roteiro (rot_scripts): fase (script_tarefa), prazo (prazo_roteiro)
 * e/ou data do calendário (data_postagem). Só grava os campos passados.
 */
export async function updateRoteiroScript(
  id: string,
  fields: {
    script_tarefa?: string;
    prazo_roteiro?: string | null;
    data_postagem?: string | null;
    comentarios?: string | null;
    link_drive?: string;
    legenda?: string;
    link_capa?: string;
    responsavel?: string;
  }
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const { error } = await rot().from("rot_scripts").update(fields).eq("id", id);
  if (error) throw error;
}
