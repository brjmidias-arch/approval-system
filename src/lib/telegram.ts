/**
 * Notificação no Telegram (best-effort). Envia uma mensagem para o chat/grupo
 * configurado em TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID. Se não estiver configurado
 * ou falhar, não faz nada (nunca quebra o fluxo de aprovação).
 */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // best-effort
  }
}

/** Escapa caracteres que quebram o parse_mode HTML do Telegram. */
export function tgEscape(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
