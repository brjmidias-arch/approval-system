import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const item = await prisma.contentItem.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        title: true,
        caption: true,
        scheduledDate: true,
        contentType: true,
        groupId: true,
        driveUrl: true,
        order: true,
        campaign: { select: { name: true, client: { select: { name: true } } } },
        client: { select: { name: true } },
        approvalItem: { select: { clientComment: true, clientCommentResolved: true } },
        internalReviewItem: { select: { comment: true, commentResolved: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    }

    // Carrossel: agrega todos os slides do mesmo groupId. Único: só o item.
    const slidesRaw =
      item.contentType === "CARROSSEL" && item.groupId
        ? await prisma.contentItem.findMany({
            where: { groupId: item.groupId },
            orderBy: { order: "asc" },
            select: { id: true, fileUrl: true, fileType: true, order: true },
          })
        : [{ id: item.id, fileUrl: item.fileUrl, fileType: item.fileType, order: item.order }];

    return NextResponse.json({
      campaignName: item.campaign?.name ?? null,
      clientName: item.client?.name ?? item.campaign?.client?.name ?? "",
      title: item.title,
      caption: item.caption,
      scheduledDate: item.scheduledDate,
      contentType: item.contentType,
      driveUrl: item.driveUrl,
      slides: slidesRaw,
      clientComment: item.approvalItem?.clientComment ?? null,
      clientCommentResolved: item.approvalItem?.clientCommentResolved ?? false,
      internalComment: item.internalReviewItem?.comment ?? null,
      internalCommentResolved: item.internalReviewItem?.commentResolved ?? false,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar post" }, { status: 500 });
  }
}
