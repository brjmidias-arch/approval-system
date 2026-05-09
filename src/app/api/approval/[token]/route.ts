import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
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
  } catch {
    return NextResponse.json({ error: "Erro ao buscar campanha" }, { status: 500 });
  }
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

  // IDOR guard: ensure the item belongs to this campaign
  const contentItem = await prisma.contentItem.findFirst({
    where: { id: contentItemId, campaignId: campaign.id },
  });
  if (!contentItem) {
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }

  try {
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

    // Auto-close: only check approval items for currently-visible items.
    // Comparing allItems.length vs totalVisible caused a mismatch when an item's
    // internal review status changed after the client already approved it — the
    // ApprovalItem remains but the item becomes hidden, so counts diverge and
    // auto-close never fires.
    const visibleItems = await prisma.contentItem.findMany({
      where: {
        campaignId: campaign.id,
        OR: [
          { internalReviewItem: { is: null } },
          { internalReviewItem: { is: { status: "APPROVED" } } },
        ],
      },
      select: { id: true },
    });
    const visibleIds = visibleItems.map((i) => i.id);
    const approvalItemsForVisible = await prisma.approvalItem.findMany({
      where: { campaignId: campaign.id, contentItemId: { in: visibleIds } },
    });
    const allReviewed =
      visibleIds.length > 0 &&
      approvalItemsForVisible.length === visibleIds.length &&
      approvalItemsForVisible.every((a) => a.status !== "PENDING");
    if (allReviewed) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "CLOSED" },
      });
    }

    return NextResponse.json(approvalItem);
  } catch {
    return NextResponse.json({ error: "Erro ao salvar avaliação" }, { status: 500 });
  }
}
