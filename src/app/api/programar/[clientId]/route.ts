import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";
import { notifyTelegram, tgEscape } from "@/lib/telegram";

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: { name: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Posts agendáveis do cliente: aprovados, ainda não agendados nem postados, não-TEXTO.
    // (O admin prepara a data no dashboard; aqui o social media vê e clica "Agendado".)
    const items = await prisma.contentItem.findMany({
      where: {
        clientId: params.clientId,
        status: "APPROVED",
        postedAt: null,
        contentType: { not: "TEXTO" },
      },
      orderBy: { order: "asc" },
      select: {
        id: true, contentType: true, groupId: true, title: true, caption: true,
        fileUrl: true, fileType: true, coverUrl: true, coverDriveUrl: true, driveUrl: true,
        scheduledDate: true,
        approvalItem: { select: { reviewedAt: true } },
      },
    });

    // Carrossel = 1 post (representado pelo primeiro slide por order)
    const seen = new Set<string>();
    const posts = [];
    for (const it of items) {
      const key = it.contentType === "CARROSSEL" && it.groupId ? `g:${it.groupId}` : `i:${it.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      posts.push({
        id: it.id,
        campaignId: params.clientId,
        campaignName: "",
        title: it.title,
        contentType: it.contentType,
        fileType: it.fileType,
        fileUrl: it.fileUrl,
        coverUrl: it.coverUrl,
        coverDriveUrl: it.coverDriveUrl,
        caption: it.caption,
        driveUrl: it.driveUrl,
        groupId: it.groupId,
        scheduledDate: it.scheduledDate ? it.scheduledDate.toISOString() : null,
        postedAt: null,
        approvedAt: it.approvalItem?.reviewedAt ? it.approvalItem.reviewedAt.toISOString() : null,
      });
    }

    const result = posts.length > 0
      ? [{ campaignId: params.clientId, campaignName: client.name, posts }]
      : [];

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

    // Guarda IDOR + agendabilidade: o item precisa ser do cliente E estar aprovado/não postado.
    const item = await prisma.contentItem.findFirst({
      where: {
        id: contentItemId,
        clientId: params.clientId,
        status: "APPROVED",
        postedAt: null,
        contentType: { not: "TEXTO" },
      },
      select: { id: true, groupId: true, contentType: true, title: true, scheduledDate: true, client: { select: { name: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: "Item não disponível para agendamento" }, { status: 404 });
    }

    // Agendou com a data certa = post CONCLUÍDO. Vai direto para "Concluído" (PUBLISHED)
    // e o Roteirização recebe data_postagem = data agendada + status "Concluído" (via sync).
    // Carrossel = grupo inteiro.
    const ids = item.contentType === "CARROSSEL" && item.groupId
      ? (await prisma.contentItem.findMany({ where: { groupId: item.groupId }, select: { id: true } })).map((s) => s.id)
      : [item.id];
    await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", postedAt: new Date() } });
    await Promise.all(ids.map((id) => syncRoteiroStatus(id)));

    // Aviso no Telegram (best-effort): post agendado com data = concluído.
    const dataTxt = item.scheduledDate
      ? item.scheduledDate.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
      : null;
    await notifyTelegram(
      `🗓️ <b>Post agendado (concluído)</b>\nCliente: ${tgEscape(item.client?.name)}\nPost: ${tgEscape(item.title || "(sem título)")}${dataTxt ? `\n📅 Programado para ${dataTxt}` : ""}`
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao marcar como agendado" }, { status: 500 });
  }
}
