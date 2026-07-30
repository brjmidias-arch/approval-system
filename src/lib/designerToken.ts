import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Tokens globais (não por cliente) dos links do designer — guardados no banco
 * (tabela Setting), então são FIXOS e estáveis: não mudam se o segredo do app for
 * rotacionado e são iguais em qualquer ambiente que aponte para o mesmo banco.
 * get-or-create: gera um UUID na primeira vez e reutiliza sempre.
 */
async function getOrCreateToken(key: string): Promise<string> {
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (existing) return existing.value;
  const value = randomUUID();
  try {
    await prisma.setting.create({ data: { key, value } });
    return value;
  } catch {
    // corrida: outra requisição criou primeiro
    const again = await prisma.setting.findUnique({ where: { key } });
    return again?.value ?? value;
  }
}

/** Link do designer com TODOS os posts que precisam de capa. */
export function designerCoverToken(): Promise<string> {
  return getOrCreateToken("designer_cover_token");
}

/** Link do designer com TODOS os ajustes pedidos. */
export function designerAdjustToken(): Promise<string> {
  return getOrCreateToken("designer_adjust_token");
}
