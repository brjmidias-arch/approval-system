import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { token: params.token },
    include: {
      client: true,
      contentItems: {
        orderBy: { order: "asc" },
        include: { approvalItem: true },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  }

  if (new Date() > new Date(campaign.expiresAt) && campaign.status === "OPEN") {
    return NextResponse.json({ error: "expired" }, { status: 410 });
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

  if (new Date() > new Date(campaign.expiresAt)) {
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });
  }

  const body = await req.json();
  const { contentItemId, status, clientComment } = body;

  if (!contentItemId || !status) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const approvalItem = await prisma.approvalItem.upsert({
    where: { contentItemId },
    update: {
      status,
      clientComment: clientComment || null,
      reviewedAt: new Date(),
    },
    create: {
      contentItemId,
      campaignId: campaign.id,
      status,
      clientComment: clientComment || null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json(approvalItem);
}
