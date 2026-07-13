import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSchedulablePosts } from "@/lib/programacao";

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: { name: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        clientId: params.clientId,
        OR: [
          { status: { in: ["CLOSED", "PUBLISHED"] } },
          { contentItems: { some: { sentToProgramacaoAt: { not: null } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        approvalItems: { select: { contentItemId: true, status: true, reviewedAt: true } },
        contentItems: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            contentType: true,
            groupId: true,
            title: true,
            caption: true,
            fileUrl: true,
            fileType: true,
            coverUrl: true,
            coverDriveUrl: true,
            driveUrl: true,
            scheduledDate: true,
            postedAt: true,
            sentToProgramacaoAt: true,
            internalReviewItem: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = campaigns
      .map((c) => ({
        campaignId: c.id,
        campaignName: c.name,
        posts: getSchedulablePosts(c).filter((p) => !p.postedAt),
      }))
      .filter((c) => c.posts.length > 0);

    return NextResponse.json({ clientName: client.name, campaigns: result });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar programação" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { clientId: string } }) {
  try {
    const { contentItemId } = await req.json();
    if (!contentItemId) {
      return NextResponse.json({ error: "Campo obrigatório faltando" }, { status: 400 });
    }

    // Guarda IDOR + agendabilidade: o item precisa pertencer a este cliente E estar
    // de fato liberado para agendamento (mesma regra da listagem, via getSchedulablePosts).
    // Endurece este endpoint público de escrita contra marcar itens não-agendáveis.
    const campaign = await prisma.campaign.findFirst({
      where: {
        clientId: params.clientId,
        contentItems: { some: { id: contentItemId } },
      },
      select: {
        id: true,
        name: true,
        status: true,
        approvalItems: { select: { contentItemId: true, status: true, reviewedAt: true } },
        contentItems: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            contentType: true,
            groupId: true,
            title: true,
            caption: true,
            fileUrl: true,
            fileType: true,
            coverUrl: true,
            coverDriveUrl: true,
            driveUrl: true,
            scheduledDate: true,
            postedAt: true,
            sentToProgramacaoAt: true,
            internalReviewItem: { select: { status: true } },
          },
        },
      },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    const schedulable = getSchedulablePosts(campaign).filter((p) => !p.postedAt);
    if (!schedulable.some((p) => p.id === contentItemId)) {
      return NextResponse.json({ error: "Item não disponível para agendamento" }, { status: 404 });
    }

    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { postedAt: new Date() },
    });

    // Auto-publish: se todos os itens APPROVED da campanha já foram postados, publica.
    const campaignItems = await prisma.contentItem.findMany({
      where: { campaignId: campaign.id },
      include: { approvalItem: true },
    });
    const approvedItems = campaignItems.filter((i) => i.approvalItem?.status === "APPROVED");
    if (approvedItems.length > 0 && approvedItems.every((i) => i.postedAt)) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "PUBLISHED" },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao marcar como agendado" }, { status: 500 });
  }
}
