/** Envia uma mensagem ao Telegram (best-effort). No-op se token/chat não vierem. */
async function sendTelegram(token: string | undefined, chatId: string | undefined, text: string): Promise<void> {
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

/**
 * Notificação no Telegram (best-effort). Envia para o grupo principal configurado
 * em TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID. Se não estiver configurado ou falhar,
 * não faz nada (nunca quebra o fluxo de aprovação).
 */
export async function notifyTelegram(text: string): Promise<void> {
  await sendTelegram(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, text);
}

/**
 * Segundo canal, só para aprovações (revisão interna + aprovar capa). Usa, por
 * padrão, o MESMO bot (TELEGRAM_BOT_TOKEN) mandando para um grupo próprio
 * (TELEGRAM_APPROVALS_CHAT_ID). Opcional: um bot separado via
 * TELEGRAM_APPROVALS_BOT_TOKEN. No-op se o grupo não estiver configurado — ou seja,
 * o grupo principal continua recebendo só o que já recebe.
 */
export async function notifyTelegramApprovals(text: string): Promise<void> {
  const token = process.env.TELEGRAM_APPROVALS_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  await sendTelegram(token, process.env.TELEGRAM_APPROVALS_CHAT_ID, text);
}

/** Escapa caracteres que quebram o parse_mode HTML do Telegram. */
export function tgEscape(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
