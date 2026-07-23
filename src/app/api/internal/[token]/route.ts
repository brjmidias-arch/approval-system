import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const POST_SELECT = {
  id: true, fileUrl: true, fileType: true, contentType: true, title: true, caption: true,
  scheduledDate: true, groupId: true, order: true, coverUrl: true, coverDriveUrl: true, driveUrl: true,
  internalReviewItem: { select: { status: true, comment: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const client = await prisma.client.findUnique({ where: { internalToken: params.token }, select: { id: true, name: true, token: true, internalToken: true } });
    if (client) {
      const contentItems = await prisma.contentItem.findMany({
        where: { clientId: client.id, status: "INTERNAL_REVIEW" },
        orderBy: { order: "asc" },
        select: POST_SELECT,
      });
      return NextResponse.json({ id: client.id, name: client.name, token: client.token, internalToken: client.internalToken, status: "INTERNAL_REVIEW", client: { name: client.name }, contentItems });
    }
    const campaign = await prisma.campaign.findUnique({ where: { internalToken: params.token }, select: { client: { select: { internalToken: true } } } });
    if (campaign?.client?.internalToken) {
      return NextResponse.json({ redirect: campaign.client.internalToken });
    }
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar revisão" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({ where: { internalToken: params.token }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, status, comment } = body;
  const VALID = ["APPROVED", "ADJUSTMENT", "REJECTED"];
  if (!contentItemId || !status || !VALID.includes(status)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
  }

  // IDOR + gate de etapa: item precisa ser do cliente E estar na etapa interna
  // (INTERNAL_REVIEW, ou INTERNAL_DONE para permitir reabrir a decisão interna).
  const item = await prisma.contentItem.findFirst({
    where: { id: contentItemId, clientId: client.id, status: { in: ["INTERNAL_REVIEW", "INTERNAL_DONE"] } },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Item não disponível para revisão" }, { status: 404 });

  try {
    await prisma.internalReviewItem.upsert({
      where: { contentItemId },
      update: { status, comment: comment || null, commentResolved: false, reviewedAt: new Date() },
      create: { contentItemId, status, comment: comment || null, commentResolved: false, reviewedAt: new Date() },
    });
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: status === "APPROVED" ? "INTERNAL_DONE" : "INTERNAL_REVIEW" },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar revisão" }, { status: 500 });
  }
}
