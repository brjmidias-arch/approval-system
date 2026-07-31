import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegramApprovals, tgEscape } from "@/lib/telegram";
import { notifyApprovalStep } from "@/lib/notifyStep";
import { buildAprovacaoMsg } from "@/lib/aprovacaoMsg";

const BASE = process.env.NEXTAUTH_URL || "";

// Envia, pelo bot, para o GRUPO DE APROVAÇÕES:
//   kind="internal" → a mesma mensagem de aprovação interna que era copiada.
//   kind="cover"    → a capa para aprovação (formato "Capa aguardando aprovação" + link /capa).
export async function POST(req: NextRequest, { params }: { params: { itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { kind } = await req.json();
  if (kind !== "internal" && kind !== "cover") {
    return NextResponse.json({ error: "kind inválido" }, { status: 400 });
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: params.itemId },
    select: {
      id: true, title: true, asanaUrl: true, roteiroConteudoId: true,
      client: { select: { name: true, internalToken: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  try {
    if (kind === "internal") {
      const msg = buildAprovacaoMsg({
        title: item.title,
        clientName: item.client?.name ?? "",
        asanaUrl: item.asanaUrl,
        connected: !!item.roteiroConteudoId,
        internalUrl: item.client?.internalToken ? `${BASE}/revisar/${item.client.internalToken}` : null,
      });
      await notifyTelegramApprovals(tgEscape(msg));
    } else {
      // Reaproveita o formato padrão (Capa aguardando aprovação + responsável + link /capa).
      await notifyApprovalStep(item.id, "🖼️ Capa para aprovação");
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao enviar" }, { status: 500 });
  }
}
