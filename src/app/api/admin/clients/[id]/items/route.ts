import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json();
  const { fileUrl, fileType, title, caption, scheduledDate, driveUrl, coverUrl, coverDriveUrl, contentType, groupId, order, asanaUrl, roteiroConteudoId } = body;
  if (!fileUrl || !fileType || !contentType) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  try {
    const item = await prisma.contentItem.create({
      data: {
        clientId: client.id,
        status: "DRAFT",
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
        order: order ?? 0,
        asanaUrl: asanaUrl || null,
        roteiroConteudoId: roteiroConteudoId || null,
      },
    });
    // Se já nasceu conectado a um roteiro, espelha no Roteirização (best-effort).
    if (roteiroConteudoId) await syncRoteiroStatus(item.id);
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar post" }, { status: 500 });
  }
}
