/**
 * Links curtos dos links públicos do cliente: o código é o começo do próprio token
 * (10 hex, sem hífens), então não precisa de coluna nova e os links longos continuam valendo.
 * O WhatsApp quebrava a exibição do UUID com hífens no meio da URL.
 *   /a/<código> → /aprovar/<token>   /f/<código> → /feed/<token>   /c/<código> → /calendario/<token>
 */
export const SHORT_LEN = 10;

export type ShortKind = "a" | "f" | "c";

export const SHORT_TARGET: Record<ShortKind, string> = { a: "aprovar", f: "feed", c: "calendario" };

export function shortCode(token: string): string {
  return token.replace(/-/g, "").slice(0, SHORT_LEN);
}

/** URL curta (`origin` sem barra no fim). */
export function shortUrl(origin: string, kind: ShortKind, token: string): string {
  return `${origin}/${kind}/${shortCode(token)}`;
}

/** Prefixo do token (com hífen) correspondente ao código, ou null se o código for inválido. */
export function tokenPrefix(code: string): string | null {
  const c = code.toLowerCase();
  if (!new RegExp(`^[0-9a-f]{${SHORT_LEN}}$`).test(c)) return null;
  return `${c.slice(0, 8)}-${c.slice(8)}`;
}
