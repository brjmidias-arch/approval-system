import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";
import { notifyTelegram, tgEscape } from "@/lib/telegram";
import { loadResponsaveis } from "@/lib/notifyStep";

const POST_SELECT = {
  id: true, fileUrl: true, fileType: true, contentType: true, title: true, caption: true,
  scheduledDate: true, groupId: true, order: true, coverUrl: true, coverDriveUrl: true, driveUrl: true,
  internalReviewItem: { select: { status: true, comment: true, commentResolved: true } },
  approvalItem: { select: { clientComment: true, clientCommentResolved: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const client = await prisma.client.findUnique({ where: { internalToken: params.token }, select: { id: true, name: true, token: true, internalToken: true } });
    if (client) {
      const contentItems = await prisma.contentItem.findMany({
        // Some do link quando o INTERNO pediu ajuste/reprovação (fica com o designer).
        where: { clientId: client.id, status: "INTERNAL_REVIEW", NOT: { internalReviewItem: { status: { in: ["ADJUSTMENT", "REJECTED"] } } } },
        orderBy: { order: "asc" },
        select: POST_SELECT,
      });
      return NextResponse.json({ id: client.id, name: client.name, token: client.token, internalToken: client.internalToken, status: "INTERNAL_REVIEW", client: { name: client.name }, contentItems });
    }
    const campaign = await prisma.campaign.findUnique({ where: { internalToken: params.token }, select: { client: { select: { internalToken: true } } } });
    if (campaign?.client?.internalToken) {
      return NextResponse.json({ redirect: campaign.client.internalToken });
    }
    return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar revisão" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({ where: { internalToken: params.token }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, status, comment, action, caption } = body;

  // Editar a legenda (auto-save) sem pedir ajuste. Grava no grupo do carrossel.
  if (action === "save-caption") {
    if (!contentItemId) return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    const item = await prisma.contentItem.findFirst({
      where: { id: contentItemId, clientId: client.id, status: { in: ["INTERNAL_REVIEW", "INTERNAL_DONE"] } },
      select: { id: true, groupId: true },
    });
    if (!item) return NextResponse.json({ error: "Item não disponível" }, { status: 404 });
    const capVal = typeof caption === "string" && caption.trim() ? caption : null;
    const ids = item.groupId
      ? (await prisma.contentItem.findMany({ where: { groupId: item.groupId }, select: { id: true } })).map((s) => s.id)
      : [item.id];
    await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { caption: capVal } });
    await syncRoteiroStatus(item.id); // empurra a legenda ao Roteirização (best-effort)
    return NextResponse.json({ success: true });
  }

  const VALID = ["APPROVED", "ADJUSTMENT", "REJECTED"];
  if (!contentItemId || !status || !VALID.includes(status)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
  }

  // IDOR + gate de etapa: item precisa ser do cliente E estar na etapa interna
  // (INTERNAL_REVIEW, ou INTERNAL_DONE para permitir reabrir a decisão interna).
  const item = await prisma.contentItem.findFirst({
    where: { id: contentItemId, clientId: client.id, status: { in: ["INTERNAL_REVIEW", "INTERNAL_DONE"] } },
    select: { id: true, title: true, groupId: true, order: true, contentType: true, fileType: true, client: { select: { name: true } } },
  });
  if (!item) return NextResponse.json({ error: "Item não disponível para revisão" }, { status: 404 });

  try {
    await prisma.internalReviewItem.upsert({
      where: { contentItemId },
      update: { status, comment: comment || null, commentResolved: false, reviewedAt: new Date() },
      create: { contentItemId, status, comment: comment || null, commentResolved: false, reviewedAt: new Date() },
    });

    if (status === "APPROVED") {
      // Aprovado internamente → passa AUTOMATICAMENTE para a aprovação do cliente
      // (cria/reseta a aprovação pendente para o post aparecer no link do cliente).
      await prisma.contentItem.update({ where: { id: contentItemId }, data: { status: "CLIENT_REVIEW" } });
      await prisma.approvalItem.upsert({
        where: { contentItemId },
        // Mantém o comentário do ajuste que o cliente pediu (marca como resolvido)
        // para ele ver "o que pedi (já resolvido)" ao reavaliar.
        update: { status: "PENDING", clientCommentResolved: true, reviewedAt: null },
        create: { contentItemId, status: "PENDING" },
      });
    } else {
      // Ajuste/reprovação → continua na revisão interna
      await prisma.contentItem.update({ where: { id: contentItemId }, data: { status: "INTERNAL_REVIEW" } });
    }

    await syncRoteiroStatus(contentItemId);

    // Aviso no Telegram (best-effort) — só uma vez por grupo (slide de menor order).
    const isRep = item.groupId
      ? !(await prisma.contentItem.findFirst({ where: { groupId: item.groupId, order: { lt: item.order } }, select: { id: true } }))
      : true;
    // Histórico: registra cada ajuste/reprovação da revisão interna (não é limpo ao avançar).
    if (isRep && (status === "ADJUSTMENT" || status === "REJECTED")) {
      try {
        await prisma.adjustmentHistory.create({ data: { contentItemId, source: "INTERNO", status, comment: comment || null } });
      } catch { /* best-effort */ }
    }
    const nome = tgEscape(item.client?.name);
    const post = tgEscape(item.title || "(sem título)");
    const com = tgEscape(comment);
    const designerPost = `\n\n✏️ Post p/ o designer: ${process.env.NEXTAUTH_URL || ""}/post/${contentItemId}`;
    const cfg = isRep && status !== "APPROVED" ? await loadResponsaveis() : {};
    const isVideo = item.contentType === "REELS" || item.fileType === "VIDEO";
    const respName = isVideo ? cfg.ajusteVideo : cfg.ajusteOutro;
    const respLine = respName ? `\nResponsável: ${tgEscape(respName)}` : "";
    // Revisão interna APROVADA não gera aviso (fora do escopo). Só ajuste/reprovação.
    if (isRep && status === "ADJUSTMENT") {
      await notifyTelegram(`✏️ <b>Revisão interna pediu ajuste</b>\nCliente: ${nome}\nPost: ${post}${com ? `\nAjuste: ${com}` : ""}${respLine}${designerPost}`);
    } else if (isRep && status === "REJECTED") {
      await notifyTelegram(`❌ <b>Revisão interna reprovou</b>\nCliente: ${nome}\nPost: ${post}${com ? `\nMotivo: ${com}` : ""}${respLine}${designerPost}`);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar revisão" }, { status: 500 });
  }
}
