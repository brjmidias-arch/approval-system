import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        contentItems: {
          orderBy: { order: "asc" },
          include: { approvalItem: true, internalReviewItem: true },
        },
      },
    });
    if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

    // Retroactive fix: auto-close OPEN campaigns where all visible items are already approved.
    // Catches campaigns stuck due to the approval route count-mismatch bug.
    if (campaign.status === "OPEN") {
      const usesInternalReview = campaign.contentItems.some((i) => i.internalReviewItem !== null);
      // Don't auto-close while any item is still pending internal review
      const hasPendingInternal = usesInternalReview && campaign.contentItems.some(
        (i) => !i.internalReviewItem || i.internalReviewItem.status !== "APPROVED"
      );
      if (!hasPendingInternal) {
        const visibleItems = usesInternalReview
          ? campaign.contentItems.filter((i) => i.internalReviewItem?.status === "APPROVED")
          : campaign.contentItems;
        const allApproved =
          visibleItems.length > 0 &&
          visibleItems.every((i) => i.approvalItem && i.approvalItem.status !== "PENDING");
        if (allApproved) {
          await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "CLOSED" } });
          campaign.status = "CLOSED";
        }
      }
    }

    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar campanha" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, month, year, expiresAt, status, sentToProduction } = body;
  const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(month && { month: Number(month) }),
        ...(year && { year: Number(year) }),
        ...(status === "OPEN" ? { expiresAt: oneDayFromNow } : expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        ...(status && { status }),
        ...(sentToProduction !== undefined && { sentToProduction }),
      },
    });
    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar campanha" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.campaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir campanha" }, { status: 500 });
  }
}
