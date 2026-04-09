import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileUrl, fileType, caption, scheduledDate, contentType, order } = body;

  if (!fileUrl || !fileType || !contentType) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const contentItem = await prisma.contentItem.create({
    data: {
      campaignId: params.id,
      fileUrl,
      fileType,
      caption,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      contentType,
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
