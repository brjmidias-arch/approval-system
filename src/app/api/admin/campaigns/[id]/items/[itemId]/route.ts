import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {

  const body = await req.json();
  const { title, caption, scheduledDate, fileUrl, fileType, driveUrl, coverUrl, coverDriveUrl, resetApproval, resetInternalReview, postedAt } = body;

  const item = await prisma.contentItem.update({
    where: { id: params.itemId },
    data: {
      ...(title !== undefined && { title: title || null }),
      ...(caption !== undefined && { caption: caption || null }),
      ...(scheduledDate !== undefined && {
        scheduledDate: scheduledDate ? new Date(`${scheduledDate}T12:00:00.000Z`) : null,
      }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(fileType !== undefined && { fileType }),
      ...(driveUrl !== undefined && { driveUrl: driveUrl || null }),
      ...(coverUrl !== undefined && { coverUrl: coverUrl || null }),
      ...(coverDriveUrl !== undefined && { coverDriveUrl: coverDriveUrl || null }),
      ...(postedAt !== undefined && { postedAt: postedAt ? new Date(postedAt) : null }),
    },
  });

  // Propagate scheduledDate to all slides in the same carousel group
  if (scheduledDate !== undefined && item.groupId && item.contentType === "CARROSSEL") {
    await prisma.contentItem.updateMany({
      where: { campaignId: params.id, groupId: item.groupId, id: { not: params.itemId } },
      data: { scheduledDate: scheduledDate ? new Date(`${scheduledDate}T12:00:00.000Z`) : null },
    });
  }

  if (resetApproval) {
    await prisma.approvalItem.updateMany({
      where: { contentItemId: params.itemId },
      data: { status: "PENDING", clientCommentResolved: true, reviewedAt: null },
    });
  }

  if (resetInternalReview) {
    await prisma.internalReviewItem.updateMany({
      where: { contentItemId: params.itemId },
      data: { status: "PENDING", commentResolved: true, reviewedAt: null },
    });
  }

  // Auto-publish campaign when all approved items are posted
  if (postedAt !== undefined && postedAt) {
    const campaignItems = await prisma.contentItem.findMany({
      where: { campaignId: params.id },
      include: { approvalItem: true },
    });
    const approvedItems = campaignItems.filter((i) => i.approvalItem?.status === "APPROVED");
    if (approvedItems.length > 0 && approvedItems.every((i) => i.postedAt)) {
      await prisma.campaign.update({
        where: { id: params.id },
        data: { status: "PUBLISHED" },
      });
    }
  }

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {

  const item = await prisma.contentItem.findUnique({
    where: { id: params.itemId },
  });

  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  await prisma.contentItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ success: true });
}
