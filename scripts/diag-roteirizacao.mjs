import { createClient } from "@supabase/supabase-js";

const url = process.env.ROTEIRIZACAO_SUPABASE_URL;
const key = process.env.ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("ENV ausente"); process.exit(1); }

const rot = createClient(url, key, { auth: { persistSession: false } });

const { data: clientes, error } = await rot.from("rot_clientes").select("id, nome").order("nome");
if (error) { console.error("FAIL rot_clientes:", error.message); process.exit(1); }
console.log("rot_clientes:", clientes.length);
console.log(clientes.slice(0, 8).map((c) => c.nome));

const { data: conteudos, error: e2 } = await rot
  .from("rot_conteudos")
  .select("id, titulo, tipo, status")
  .limit(5);
if (e2) { console.error("FAIL rot_conteudos:", e2.message); process.exit(1); }
console.log("sample rot_conteudos:", conteudos);
