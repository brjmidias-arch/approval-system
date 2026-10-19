import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildFeed, feedFromDate, FEED_SELECT } from "@/lib/feed";

/**
 * Prévia do feed para o link público do cliente: só os posts DESTE cliente que ele
 * já viu (pendente, aprovado, em ajuste, publicado). Rascunhos e posts que estão só
 * na revisão interna não aparecem.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({ where: { token: params.token }, select: { id: true, name: true } });
  if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  try {
    const from = feedFromDate();
    const rows = await prisma.contentItem.findMany({
      where: {
        clientId: client.id,
        OR: [
          { status: "CLIENT_REVIEW" },
          { scheduledDate: { gte: from }, status: { in: ["APPROVED", "SCHEDULED", "PUBLISHED"] } },
          // Voltou para a equipe depois de o cliente pedir ajuste.
          { scheduledDate: { gte: from }, status: { in: ["INTERNAL_REVIEW", "INTERNAL_DONE"] }, approvalItem: { isNot: null } },
        ],
      },
      orderBy: { order: "asc" },
      select: FEED_SELECT,
    });
    return NextResponse.json({ name: client.name, entries: buildFeed(rows, "client") });
  } catch {
    return NextResponse.json({ error: "Erro ao carregar o feed" }, { status: 500 });
  }
}
