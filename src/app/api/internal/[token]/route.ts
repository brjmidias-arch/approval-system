import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { internalToken: params.token },
      select: {
        id: true,
        name: true,
        month: true,
        year: true,
        status: true,
        expiresAt: true,
        token: true,
        internalToken: true,
        client: { select: { name: true } },
        contentItems: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
            contentType: true,
            title: true,
            caption: true,
            scheduledDate: true,
            groupId: true,
            order: true,
            coverUrl: true,
            coverDriveUrl: true,
            driveUrl: true,
            internalReviewItem: { select: { status: true, comment: true } },
          },
        },
      },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar campanha" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { internalToken: params.token },
    });
    if (!campaign) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const body = await req.json();
    const { contentItemId, status, comment } = body;

    const VALID_STATUSES = ["APPROVED", "ADJUSTMENT", "REJECTED"];
    if (!contentItemId || !status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
    }

    const item = await prisma.internalReviewItem.upsert({
      where: { contentItemId },
      update: {
        status,
        comment: comment || null,
        commentResolved: false,
        reviewedAt: new Date(),
      },
      create: {
        contentItemId,
        campaignId: campaign.id,
        status,
        comment: comment || null,
        commentResolved: false,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Erro ao salvar revisão" }, { status: 500 });
  }
}
