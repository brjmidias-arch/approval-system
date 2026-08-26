import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus, pullRoteiroToItem } from "@/lib/syncRoteiro";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json();
  const { fileUrl, fileType, title, caption, scheduledDate, driveUrl, coverUrl, coverDriveUrl, contentType, groupId, asanaUrl, roteiroConteudoId } = body;
  if (!fileUrl || !fileType || !contentType) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  try {
    // Ordem definida no servidor = maior order do cliente + 1. Robusto contra
    // exclusões/contagem defasada (evita colisão/embaralhamento com itens existentes).
    // Uploads mandam os slides em sequência (await), então cada POST pega o próximo.
    const agg = await prisma.contentItem.aggregate({ where: { clientId: client.id }, _max: { order: true } });
    const nextOrder = (agg._max.order ?? 0) + 1;

    const item = await prisma.contentItem.create({
      data: {
        clientId: client.id,
        status: "INTERNAL_REVIEW",
        fileUrl,
        fileType,
        title: title || null,
        caption: caption || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        driveUrl: driveUrl || null,
        coverUrl: coverUrl || null,
        coverDriveUrl: coverDriveUrl || null,
        contentType,
        groupId: groupId || null,
        order: nextOrder,
        asanaUrl: asanaUrl || null,
        roteiroConteudoId: roteiroConteudoId || null,
      },
    });
    // Post nasce direto em Revisão interna: cria o registro de revisão (PENDING).
    await prisma.internalReviewItem.create({ data: { contentItemId: item.id, status: "PENDING" } });
    // Se já nasceu conectado a um roteiro: puxa legenda + data de previsão do
    // Roteirização (best-effort) e depois espelha o estado de volta.
    if (roteiroConteudoId) {
      await pullRoteiroToItem(item.id);
      await syncRoteiroStatus(item.id);
    }
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar post" }, { status: 500 });
  }
}
