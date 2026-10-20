import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SHORT_TARGET, tokenPrefix, type ShortKind } from "@/lib/shortLink";

/** Resolve /a|f|c/<código> para o link longo do cliente (mantém a query, ex.: ?semana=). */
export async function redirectShort(req: NextRequest, kind: ShortKind, code: string) {
  const prefix = tokenPrefix(code);
  const matches = prefix
    ? await prisma.client.findMany({ where: { token: { startsWith: prefix } }, select: { token: true }, take: 2 })
    : [];
  if (matches.length !== 1 || !matches[0].token) {
    return new NextResponse("Link não encontrado", { status: 404 });
  }
  const url = new URL(`/${SHORT_TARGET[kind]}/${matches[0].token}`, req.url);
  url.search = req.nextUrl.search;
  return NextResponse.redirect(url);
}
