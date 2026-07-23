import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  let items;
  try {
    items = await prisma.contentItem.findMany({
      where: {
        clientId: params.id,
        approvalItem: { status: "APPROVED" },
        contentType: { not: "TEXTO" },
        OR: [
          { scheduledDate: null },
          { scheduledDate: { gte: startOfMonth } },
        ],
      },
      orderBy: { order: "asc" },
      include: { client: { select: { name: true } } },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar posts" }, { status: 500 });
  }

  const seenGroupIds = new Set<string>();
  const posts: {
    id: string;
    title: string | null;
    contentType: string;
    fileUrl: string;
    fileType: string;
    coverUrl: string | null;
    caption: string | null;
    scheduledDate: string | null;
    clientName: string;
    campaignName: string;
    campaignId: string;
  }[] = [];

  for (const item of items) {
    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seenGroupIds.has(item.groupId)) continue;
      seenGroupIds.add(item.groupId);
    }
    posts.push({
      id: item.id,
      title: item.title,
      contentType: item.contentType,
      fileType: item.fileType,
      fileUrl: item.fileUrl,
      coverUrl: item.coverUrl,
      caption: item.caption,
      scheduledDate: item.scheduledDate ? item.scheduledDate.toISOString() : null,
      clientName: item.client?.name ?? "",
      campaignName: "",
      campaignId: params.id,
    });
  }

  return NextResponse.json(posts);
}
