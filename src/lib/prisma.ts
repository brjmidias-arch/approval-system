import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Na Vercel (serverless), usa o pooler do Supabase em MODO TRANSAÇÃO (porta 6543,
 * pgbouncer=true, 1 conexão por instância). O modo sessão (5432) só aceita 15
 * clientes e lotava ("max clients reached"), derrubando telas aleatoriamente.
 * Local e migrações (DIRECT_URL) continuam como estão.
 */
function runtimeDbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !process.env.VERCEL) return undefined;
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith("pooler.supabase.com")) return undefined;
    u.port = "6543";
    u.searchParams.set("pgbouncer", "true");
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    return u.toString();
  } catch {
    return undefined;
  }
}

const dbUrl = runtimeDbUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(dbUrl && { datasources: { db: { url: dbUrl } } }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
