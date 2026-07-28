import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";

// ids de todos os itens do "post" (grupo do carrossel, ou o próprio item)
async function postItemIds(itemId: string): Promise<string[]> {
  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    select: { id: true, groupId: true, contentType: true },
  });
  if (!item) return [];
  if (item.contentType === "CARROSSEL" && item.groupId) {
    const slides = await prisma.contentItem.findMany({ where: { groupId: item.groupId }, select: { id: true } });
    return slides.map((s) => s.id);
  }
  return [item.id];
}

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const exists = await prisma.contentItem.findUnique({ where: { id: params.itemId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  const body = await req.json();
  const { title, caption, scheduledDate, driveUrl, coverUrl, coverDriveUrl, fileUrl, fileType, contentType, roteiroConteudoId, asanaUrl, sentToProgramacao, action } = body;

  try {
    // 1) Edições de campos no item clicado
    await prisma.contentItem.update({
      where: { id: params.itemId },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(caption !== undefined && { caption: caption || null }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(`${scheduledDate}T12:00:00.000Z`) : null }),
        ...(driveUrl !== undefined && { driveUrl: driveUrl || null }),
        ...(coverUrl !== undefined && { coverUrl: coverUrl || null }),
        ...(coverDriveUrl !== undefined && { coverDriveUrl: coverDriveUrl || null }),
        ...(fileUrl !== undefined && { fileUrl }),
        ...(fileType !== undefined && { fileType }),
        ...(contentType !== undefined && { contentType }),
        ...(roteiroConteudoId !== undefined && { roteiroConteudoId: roteiroConteudoId || null }),
        ...(asanaUrl !== undefined && { asanaUrl: asanaUrl || null }),
      },
    });

    const ids = await postItemIds(params.itemId);

    // Data e programação propagam ao grupo
    if (scheduledDate !== undefined) {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { scheduledDate: scheduledDate ? new Date(`${scheduledDate}T12:00:00.000Z`) : null } });
    }
    if (sentToProgramacao !== undefined) {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { sentToProgramacaoAt: sentToProgramacao ? new Date() : null } });
    }

    // 2) Transições de etapa (propagam ao grupo)
    if (action === "send-internal") {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "INTERNAL_REVIEW" } });
      for (const id of ids) {
        await prisma.internalReviewItem.upsert({
          where: { contentItemId: id },
          update: { status: "PENDING", comment: null, commentResolved: false, reviewedAt: null },
          create: { contentItemId: id, status: "PENDING" },
        });
      }
    } else if (action === "send-client") {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "CLIENT_REVIEW", sentToProgramacaoAt: null } });
      for (const id of ids) {
        await prisma.approvalItem.upsert({
          where: { contentItemId: id },
          update: { status: "PENDING", clientComment: null, clientCommentResolved: false, reviewedAt: null },
          create: { contentItemId: id, status: "PENDING" },
        });
      }
    } else if (action === "adjustment-done") {
      // Ajuste concluído: volta para Revisão interna. Mantém os comentários (marca
      // como resolvidos) para permitir desfazer ("Voltar para ajuste").
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "INTERNAL_REVIEW" } });
      for (const id of ids) {
        await prisma.internalReviewItem.upsert({
          where: { contentItemId: id },
          update: { status: "PENDING", commentResolved: true, reviewedAt: null },
          create: { contentItemId: id, status: "PENDING" },
        });
        await prisma.approvalItem.updateMany({
          where: { contentItemId: id, status: { in: ["ADJUSTMENT", "REJECTED"] } },
          data: { status: "PENDING", clientCommentResolved: true, reviewedAt: null },
        });
      }
    } else if (action === "undo-adjustment-done") {
      // Desfaz o "Ajuste feito": volta o post para a etapa de Ajustes, restaurando
      // a flag no item que carrega o comentário (cliente tem precedência).
      const comReviews = await prisma.contentItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, approvalItem: { select: { clientComment: true } }, internalReviewItem: { select: { comment: true } } },
      });
      for (const it of comReviews) {
        if (it.approvalItem?.clientComment) {
          await prisma.approvalItem.updateMany({ where: { contentItemId: it.id }, data: { status: "REJECTED", clientCommentResolved: false } });
        } else {
          await prisma.internalReviewItem.upsert({
            where: { contentItemId: it.id },
            update: { status: "ADJUSTMENT", commentResolved: false },
            create: { contentItemId: it.id, status: "ADJUSTMENT" },
          });
        }
      }
    } else if (action === "mark-approved") {
      // Volta para "Prontos p/ programar" (mantém a data planejada, se houver).
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "APPROVED", postedAt: null } });
    } else if (action === "mark-draft") {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "DRAFT", postedAt: null } });
    } else if (action === "mark-scheduled") {
      // Vai para "Posts programados". Limpa postedAt (caso volte de Concluído).
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "SCHEDULED", postedAt: null } });
    } else if (action === "mark-published") {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", postedAt: new Date() } });
    }

    // Espelha o estado no Roteirização (sequencial; best-effort).
    for (const id of ids) await syncRoteiroStatus(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar post" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ids = await postItemIds(params.itemId);
  if (ids.length === 0) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  try {
    await prisma.contentItem.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir post" }, { status: 500 });
  }
}
