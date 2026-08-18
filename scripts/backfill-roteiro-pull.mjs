// Backfill: puxa legenda + data de previsão (rot_scripts) para os posts JÁ conectados.
// Dry-run por padrão (só mostra o que mudaria). Passe --apply para gravar.
//   node scripts/backfill-roteiro-pull.mjs           (dry-run)
//   node scripts/backfill-roteiro-pull.mjs --apply   (grava)
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// Carrega .env para process.env (não sobrescreve o que já existe).
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch { /* .env opcional */ }

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
const url = process.env.ROTEIRIZACAO_SUPABASE_URL;
const key = process.env.ROTEIRIZACAO_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("ROTEIRIZACAO_SUPABASE_URL/KEY não configurados no .env"); process.exit(1); }
const rot = createClient(url, key, { auth: { persistSession: false } });

function parseRotDate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T12:00:00.000Z`);
}
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const short = (s) => (s ? String(s).replace(/\s+/g, " ").slice(0, 40) : "—");

const items = await prisma.contentItem.findMany({
  where: { roteiroConteudoId: { not: null } },
  select: {
    id: true, groupId: true, roteiroConteudoId: true, caption: true, scheduledDate: true, title: true,
    client: { select: { name: true } },
  },
});
console.log(`Posts conectados: ${items.length}${APPLY ? "  (MODO GRAVAÇÃO)" : "  (DRY-RUN — nada será gravado)"}\n`);

const cache = new Map();
let capUpd = 0, dateUpd = 0, semRoteiro = 0, shown = 0;

for (const it of items) {
  let c = cache.get(it.roteiroConteudoId);
  if (c === undefined) {
    const { data } = await rot.from("rot_scripts").select("legenda, data_postagem").eq("id", it.roteiroConteudoId).maybeSingle();
    c = data ?? null;
    cache.set(it.roteiroConteudoId, c);
  }
  if (!c) { semRoteiro++; continue; }

  const newCap = c.legenda && c.legenda.trim() ? c.legenda : null;
  const capWillChange = newCap != null && newCap !== it.caption;
  const dt = parseRotDate(c.data_postagem);
  const dateWillChange = dt != null && ymd(dt) !== ymd(it.scheduledDate);

  if (capWillChange || dateWillChange) {
    if (shown < 15) {
      console.log(`• ${it.client?.name ?? "?"} — ${short(it.title) || "(sem título)"}`);
      if (capWillChange) console.log(`    legenda: "${short(it.caption)}" -> "${short(newCap)}"`);
      if (dateWillChange) console.log(`    data:    ${ymd(it.scheduledDate)} -> ${ymd(dt)}`);
      shown++;
    }
  }

  if (APPLY) {
    if (capWillChange) { await prisma.contentItem.update({ where: { id: it.id }, data: { caption: newCap } }); }
    if (dateWillChange) {
      const ids = it.groupId
        ? (await prisma.contentItem.findMany({ where: { groupId: it.groupId }, select: { id: true } })).map((s) => s.id)
        : [it.id];
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { scheduledDate: dt } });
    }
  }
  if (capWillChange) capUpd++;
  if (dateWillChange) dateUpd++;
}

console.log(`\nResumo: legendas a atualizar=${capUpd}, datas a atualizar=${dateUpd}, sem roteiro encontrado=${semRoteiro}`);
console.log(APPLY ? "GRAVADO." : "Dry-run concluído. Rode com --apply para gravar.");
await prisma.$disconnect();
