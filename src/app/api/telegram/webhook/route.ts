import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildPendingDigest } from "@/lib/notifyStep";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.CRON_SECRET;
const BASE = process.env.NEXTAUTH_URL || "";

async function tgSend(chatId: number | string, text: string) {
  if (!TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  }).catch(() => {});
}

/**
 * GET ?setup=1 → registra este endpoint como webhook do bot no Telegram.
 * Autorizado por sessão de admin (abrir logado) OU ?secret=CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("setup") !== "1") {
    return NextResponse.json({ ok: true, hint: "Para registrar o /pendencias: abra /api/telegram/webhook?setup=1 logado no admin." });
  }
  const bySecret = !!SECRET && searchParams.get("secret") === SECRET;
  const session = bySecret ? true : await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!TOKEN || !BASE) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN/NEXTAUTH_URL ausentes" }, { status: 500 });

  const url = `${BASE}/api/telegram/webhook`;
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: SECRET || undefined, allowed_updates: ["message"] }),
  });
  return NextResponse.json({ set_to: url, telegram: await res.json() });
}

/** POST: recebe os updates do Telegram. Responde ao comando /pendencias com o digest. */
export async function POST(req: NextRequest) {
  // Valida o secret do Telegram (definido no setWebhook). Ignora chamadas sem ele.
  if (SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return NextResponse.json({ ok: true });
  }
  try {
    const update = await req.json();
    const m = update?.message ?? update?.channel_post;
    const text: string = typeof m?.text === "string" ? m.text.trim() : "";
    const chatId = m?.chat?.id;
    // /pendencias ou /pendencias@NomeDoBot
    if (chatId && /^\/pendencias(@\w+)?\b/i.test(text)) {
      const digest = await buildPendingDigest();
      await tgSend(chatId, digest ?? "✅ Nenhuma pendência no momento.");
    }
  } catch {
    // best-effort — sempre responde 200 para o Telegram não reenfileirar.
  }
  return NextResponse.json({ ok: true });
}
