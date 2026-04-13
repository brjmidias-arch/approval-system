import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {

  const body = await req.json();
  const { title, caption, scheduledDate, fileUrl, fileType, driveUrl, resetApproval, postedAt } = body;

  const item = await prisma.contentItem.update({
    where: { id: params.itemId },
    data: {
      ...(title !== undefined && { title: title || null }),
      ...(caption !== undefined && { caption: caption || null }),
      ...(scheduledDate !== undefined && {
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(fileType !== undefined && { fileType }),
      ...(driveUrl !== undefined && { driveUrl: driveUrl || null }),
      ...(postedAt !== undefined && { postedAt: postedAt ? new Date(postedAt) : null }),
    },
  });

  if (resetApproval) {
    await prisma.approvalItem.updateMany({
      where: { contentItemId: params.itemId },
      data: { status: "PENDING", clientComment: null, reviewedAt: null },
    });
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
