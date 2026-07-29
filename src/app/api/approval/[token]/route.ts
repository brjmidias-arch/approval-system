import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";

const POST_SELECT = {
  id: true, fileUrl: true, fileType: true, contentType: true, title: true, caption: true,
  scheduledDate: true, groupId: true, order: true, coverUrl: true, driveUrl: true,
  approvalItem: { select: { status: true, clientComment: true, clientCommentResolved: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Novo: token de cliente
    const client = await prisma.client.findUnique({ where: { token: params.token }, select: { id: true, name: true, token: true } });
    if (client) {
      const contentItems = await prisma.contentItem.findMany({
        where: { clientId: client.id, status: "CLIENT_REVIEW" },
        orderBy: { order: "asc" },
        select: POST_SELECT,
      });
      return NextResponse.json({ id: client.id, name: client.name, token: client.token, status: "OPEN", client: { name: client.name }, contentItems });
    }
    // Legado: token de campanha → redireciona pro link do cliente
    const campaign = await prisma.campaign.findUnique({ where: { token: params.token }, select: { client: { select: { token: true } } } });
    if (campaign?.client?.token) {
      return NextResponse.json({ redirect: campaign.client.token });
    }
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar aprovação" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({ where: { token: params.token }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, status, clientComment } = body;
  const VALID = ["APPROVED", "ADJUSTMENT", "REJECTED"];
  if (!contentItemId || !status || !VALID.includes(status)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
  }

  // IDOR + gate de etapa: item precisa ser do cliente E estar na etapa do cliente
  // (CLIENT_REVIEW, ou APPROVED para permitir mudar a decisão). Impede que um link
  // evergreen aprove um post que já voltou para revisão interna / rascunho / publicado.
  const item = await prisma.contentItem.findFirst({
    where: { id: contentItemId, clientId: client.id, status: { in: ["CLIENT_REVIEW", "APPROVED"] } },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Item não disponível para aprovação" }, { status: 404 });

  try {
    await prisma.approvalItem.upsert({
      where: { contentItemId },
      update: { status, clientComment: clientComment || null, clientCommentResolved: false, reviewedAt: new Date() },
      create: { contentItemId, status, clientComment: clientComment || null, clientCommentResolved: false, reviewedAt: new Date() },
    });
    // Move o status do post: aprovado sai do link; ajuste/reprovação continua em CLIENT_REVIEW
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { status: status === "APPROVED" ? "APPROVED" : "CLIENT_REVIEW" },
    });
    await syncRoteiroStatus(contentItemId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar avaliação" }, { status: 500 });
  }
}
