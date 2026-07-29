/**
 * Monta a mensagem padrão de aprovação interna (formato "limpo com rótulos"),
 * usada no fim do upload e no botão "Copiar msg" de cada post.
 */
export function buildAprovacaoMsg(p: {
  title: string | null;
  clientName: string;
  asanaUrl?: string | null;
  connected: boolean;
  internalUrl?: string | null;
  adjustment?: string | null;
}): string {
  const lines = [
    `Post: ${p.title?.trim() || "(sem título)"}`,
    `Cliente: ${p.clientName}`,
    `Roteirização: ${p.connected ? "conectado" : "não conectado"}`,
  ];
  if (p.adjustment?.trim()) {
    lines.push(``, `Ajuste realizado: ${p.adjustment.trim()}`);
  }
  lines.push(
    ``,
    `Asana: ${p.asanaUrl?.trim() || "—"}`,
    ``,
    `Aprovação interna: ${p.internalUrl?.trim() || "—"}`,
  );
  return lines.join("\n");
}
