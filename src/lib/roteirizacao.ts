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
};

const CONCLUIDO = new Set(["concluido", "concluído"]);
const naoConcluido = (tarefa: string | null) => !CONCLUIDO.has((tarefa ?? "").toLowerCase());

function toConteudo(s: {
  id: string;
  tipo: string | null;
  titulo: string | null;
  legenda: string | null;
  script_tarefa: string | null;
}): RotConteudo {
  return { id: s.id, tipo: s.tipo, titulo: s.titulo, legenda: s.legenda, status: s.script_tarefa };
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

/** Busca um roteiro (para puxar título/legenda ao anexar). */
export async function getConteudo(id: string): Promise<RotConteudo | null> {
  const { data, error } = await rot()
    .from("rot_scripts")
    .select("id, tipo, titulo, legenda, script_tarefa")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toConteudo(data) : null;
}

/**
 * Atualiza a fase de produção (script_tarefa) do roteiro no Roteirização.
 * PAUSADO: usuário está reconfigurando as fases no app do roteirização e vai
 * informar os nomes exatos. Reativar com o novo mapa (script_tarefa + prazo_roteiro
 * + data_postagem) quando os nomes chegarem.
 */
export async function setConteudoStatus(_id: string, _scriptTarefa: string): Promise<void> {
  // no-op temporário — aguardando nomes finais das fases.
}
