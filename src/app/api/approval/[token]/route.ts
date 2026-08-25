import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";
import { notifyTelegram, tgEscape } from "@/lib/telegram";
import { notifyNextStep, loadResponsaveis } from "@/lib/notifyStep";

const POST_SELECT = {
  id: true, fileUrl: true, fileType: true, contentType: true, title: true, caption: true,
  scheduledDate: true, groupId: true, order: true, coverUrl: true, driveUrl: true,
  approvalItem: { select: { status: true, clientComment: true, clientCommentResolved: true } },
} as const;

/** Resumo da última rodada de aprovação do cliente: aprovados x enviados para ajuste. */
async function lastRoundSummary(clientId: string): Promise<{ approved: number; adjustment: number } | null> {
  const rows = await prisma.contentItem.findMany({
    where: { clientId, approvalItem: { reviewedAt: { not: null } } },
    select: { id: true, groupId: true, approvalItem: { select: { status: true, reviewedAt: true } } },
  });
  // Carrossel = 1 post (dedup por grupo).
  const seen = new Set<string>();
  const items = rows.filter((r) => { const k = r.groupId ?? r.id; if (seen.has(k)) return false; seen.add(k); return true; });
  const dated = items.filter((i) => i.approvalItem?.reviewedAt);
  if (dated.length === 0) return null;
  // "Última rodada" = revisões dentro de 24h da revisão mais recente.
  const maxTs = Math.max(...dated.map((i) => i.approvalItem!.reviewedAt!.getTime()));
  const windowStart = maxTs - 24 * 60 * 60 * 1000;
  let approved = 0, adjustment = 0;
  for (const i of dated) {
    if (i.approvalItem!.reviewedAt!.getTime() < windowStart) continue;
    const s = i.approvalItem!.status;
    if (s === "APPROVED") approved++;
    else if (s === "ADJUSTMENT" || s === "REJECTED") adjustment++;
  }
  return approved + adjustment > 0 ? { approved, adjustment } : null;
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Novo: token de cliente
    const client = await prisma.client.findUnique({ where: { token: params.token }, select: { id: true, name: true, token: true } });
    if (client) {
      const contentItems = await prisma.contentItem.findMany({
        // Some do link quando o CLIENTE pediu ajuste/reprovação (fica com o designer).
        where: { clientId: client.id, status: "CLIENT_REVIEW", approvalItem: { status: { notIn: ["ADJUSTMENT", "REJECTED"] } } },
        orderBy: { order: "asc" },
        select: POST_SELECT,
      });
      const lastRound = contentItems.length === 0 ? await lastRoundSummary(client.id) : null;
      return NextResponse.json({ id: client.id, name: client.name, token: client.token, status: "OPEN", client: { name: client.name }, contentItems, lastRound });
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
  const { contentItemId, status, clientComment, action, caption } = body;

  // Editar a legenda (auto-save) sem pedir ajuste. Grava no grupo do carrossel.
  if (action === "save-caption") {
    if (!contentItemId) return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    const item = await prisma.contentItem.findFirst({
      where: { id: contentItemId, clientId: client.id, status: { in: ["CLIENT_REVIEW", "APPROVED"] } },
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

  // IDOR + gate de etapa: item precisa ser do cliente E estar na etapa do cliente
  // (CLIENT_REVIEW, ou APPROVED para permitir mudar a decisão). Impede que um link
  // evergreen aprove um post que já voltou para revisão interna / rascunho / publicado.
  const item = await prisma.contentItem.findFirst({
    where: { id: contentItemId, clientId: client.id, status: { in: ["CLIENT_REVIEW", "APPROVED"] } },
    select: { id: true, title: true, groupId: true, order: true, contentType: true, fileType: true, client: { select: { name: true } } },
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

    // Aviso no Telegram (best-effort) — só uma vez por grupo (slide de menor order).
    const isRep = item.groupId
      ? !(await prisma.contentItem.findFirst({ where: { groupId: item.groupId, order: { lt: item.order } }, select: { id: true } }))
      : true;
    if (isRep) {
      // Histórico: registra cada ajuste/reprovação pedido (não é limpo ao avançar).
      if (status === "ADJUSTMENT" || status === "REJECTED") {
        try {
          await prisma.adjustmentHistory.create({ data: { contentItemId, source: "CLIENTE", status, comment: clientComment || null } });
        } catch { /* best-effort */ }
      }
      const nome = tgEscape(item.client?.name);
      const post = tgEscape(item.title || "(sem título)");
      const com = tgEscape(clientComment);
      const designerPost = `\n\n✏️ Post p/ o designer: ${process.env.NEXTAUTH_URL || ""}/post/${contentItemId}`;
      if (status === "APPROVED") {
        await notifyNextStep(contentItemId, "✅ Cliente aprovou");
      } else {
        const cfg = await loadResponsaveis();
        const isVideo = item.contentType === "REELS" || item.fileType === "VIDEO";
        const respName = isVideo ? cfg.ajusteVideo : cfg.ajusteOutro;
        const respLine = respName ? `\nResponsável: ${tgEscape(respName)}` : "";
        if (status === "ADJUSTMENT") {
          await notifyTelegram(`✏️ <b>Cliente pediu ajuste</b>\nCliente: ${nome}\nPost: ${post}${com ? `\nAjuste: ${com}` : ""}${respLine}${designerPost}`);
        } else {
          await notifyTelegram(`❌ <b>Cliente reprovou</b>\nCliente: ${nome}\nPost: ${post}${com ? `\nMotivo: ${com}` : ""}${respLine}${designerPost}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar avaliação" }, { status: 500 });
  }
}
