import { createHash } from "crypto";

/**
 * Token global (não por cliente) para o link do designer com TODOS os posts que
 * precisam de capa. Derivado do segredo do app — estável e secreto, sem precisar
 * de variável de ambiente nova. Server-only (usa NEXTAUTH_SECRET).
 */
export function designerCoverToken(): string {
  const secret = process.env.NEXTAUTH_SECRET || "brj-fallback-secret";
  return createHash("sha256").update(`${secret}:cover-designer`).digest("hex").slice(0, 40);
}
