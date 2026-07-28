/**
 * Monta a mensagem padrão de aprovação interna (formato "limpo com rótulos"),
 * usada no fim do upload e no botão "Copiar msg" de cada post.
 */
export function buildAprovacaoMsg(p: {
  title: string | null;
  clientName: string;
  asanaUrl?: string | null;
  connected: boolean;
  driveUrl?: string | null;
}): string {
  return [
    `Post: ${p.title?.trim() || "(sem título)"}`,
    `Cliente: ${p.clientName}`,
    `Asana: ${p.asanaUrl?.trim() || "—"}`,
    `Roteirização: ${p.connected ? "conectado" : "não conectado"}`,
    `Drive: ${p.driveUrl?.trim() || "—"}`,
  ].join("\n");
}
