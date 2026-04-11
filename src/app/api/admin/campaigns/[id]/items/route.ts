import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {

  const body = await req.json();
  const { fileUrl, fileType, title, caption, scheduledDate, driveUrl, coverUrl, coverDriveUrl, contentType, order, groupId } = body;

  if (!fileUrl || !fileType || !contentType) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const contentItem = await prisma.contentItem.create({
    data: {
      campaignId: params.id,
      fileUrl,
      fileType,
      title: title || null,
      caption,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      driveUrl: driveUrl || null,
      coverUrl: coverUrl || null,
      coverDriveUrl: coverDriveUrl || null,
      contentType,
      groupId: groupId || null,
      order: order ?? 0,
    },
  });

  // Create the associated ApprovalItem as PENDING
  await prisma.approvalItem.create({
    data: {
      contentItemId: contentItem.id,
      campaignId: params.id,
      status: "PENDING",
    },
  });

  return NextResponse.json(contentItem, { status: 201 });
}
