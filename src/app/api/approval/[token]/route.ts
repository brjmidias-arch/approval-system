import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { token: params.token },
    select: {
      id: true,
      name: true,
      month: true,
      year: true,
      status: true,
      expiresAt: true,
      client: { select: { name: true } },
      contentItems: {
        orderBy: { order: "asc" },
        where: {
          OR: [
            { internalReviewItem: { is: null } },
            { internalReviewItem: { is: { status: "APPROVED" } } },
          ],
        },
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
          driveUrl: true,
          approvalItem: { select: { status: true, clientComment: true } },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  }

  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { token: params.token },
  });

  if (!campaign) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (campaign.status === "CLOSED") {
    return NextResponse.json({ error: "Campanha encerrada" }, { status: 403 });
  }

  const body = await req.json();
  const { contentItemId, status, clientComment } = body;

  const VALID_STATUSES = ["APPROVED", "ADJUSTMENT", "REJECTED"];
  if (!contentItemId || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
  }

  const approvalItem = await prisma.approvalItem.upsert({
    where: { contentItemId },
    update: {
      status,
      clientComment: clientComment || null,
      clientCommentResolved: false,
      reviewedAt: new Date(),
    },
    create: {
      contentItemId,
      campaignId: campaign.id,
      status,
      clientComment: clientComment || null,
      clientCommentResolved: false,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json(approvalItem);
}
