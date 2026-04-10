import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, caption, scheduledDate } = body;

  const item = await prisma.contentItem.update({
    where: { id: params.itemId },
    data: {
      ...(title !== undefined && { title: title || null }),
      ...(caption !== undefined && { caption: caption || null }),
      ...(scheduledDate !== undefined && {
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      }),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.contentItem.findUnique({
    where: { id: params.itemId },
  });

  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  await prisma.contentItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ success: true });
}
