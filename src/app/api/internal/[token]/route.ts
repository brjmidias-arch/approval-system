import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { internalToken: params.token },
    include: {
      client: true,
      contentItems: {
        orderBy: { order: "asc" },
        include: { internalReviewItem: true },
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
    where: { internalToken: params.token },
  });

  if (!campaign) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, status, comment } = body;

  if (!contentItemId || !status) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const item = await prisma.internalReviewItem.upsert({
    where: { contentItemId },
    update: {
      status,
      comment: comment || null,
      reviewedAt: new Date(),
    },
    create: {
      contentItemId,
      campaignId: campaign.id,
      status,
      comment: comment || null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json(item);
}
