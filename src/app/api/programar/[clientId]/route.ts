import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus, refreshPrevisaoForItems } from "@/lib/syncRoteiro";
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
        scheduledDate: true, agendadoDate: true, roteiroConteudoId: true,
        approvalItem: { select: { reviewedAt: true } },
      },
    });

    // Atualiza a PREVISÃO a partir do Roteirização (reflete mudanças feitas lá).
    const previsao = await refreshPrevisaoForItems(
      items.map((i) => ({ id: i.id, roteiroConteudoId: i.roteiroConteudoId, scheduledDate: i.scheduledDate }))
    );

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
        scheduledDate: previsao[it.id] ? previsao[it.id]!.toISOString() : null, // = previsão
        agendadoDate: it.agendadoDate ? it.agendadoDate.toISOString() : null,
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
    const { contentItemId, agendadoDate, action } = await req.json();
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
      select: { id: true, groupId: true, contentType: true, title: true, agendadoDate: true, client: { select: { name: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: "Item não disponível para agendamento" }, { status: 404 });
    }

    // Carrossel = grupo inteiro (a data e o status valem para todos os slides).
    const ids = item.contentType === "CARROSSEL" && item.groupId
      ? (await prisma.contentItem.findMany({ where: { groupId: item.groupId }, select: { id: true } })).map((s) => s.id)
      : [item.id];

    // Converte "YYYY-MM-DD" → meio-dia UTC (mesmo padrão do dashboard, evita virar o dia por fuso).
    const parseDate = (s: unknown) =>
      typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00.000Z`) : null;

    // Ação "salvar data": grava a DATA DE AGENDAMENTO no grupo (auto-save no link).
    if (action === "set-date") {
      const dt = parseDate(agendadoDate);
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { agendadoDate: dt } });
      return NextResponse.json({ success: true, agendadoDate: dt ? dt.toISOString() : null });
    }

    // Conclusão (clique em "Agendado"): a data de agendamento é OBRIGATÓRIA.
    const dtBody = parseDate(agendadoDate);
    if (dtBody) {
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { agendadoDate: dtBody } });
    }
    const dataAgendada = dtBody ?? item.agendadoDate;
    if (!dataAgendada) {
      return NextResponse.json({ error: "Escolha a data do agendamento antes de marcar como agendado." }, { status: 400 });
    }

    // Agendou com a data certa = post CONCLUÍDO. Vai direto para "Concluído" (PUBLISHED)
    // e o Roteirização recebe data_postagem = data agendada + status "Concluído" (via sync).
    await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", postedAt: new Date() } });
    await Promise.all(ids.map((id) => syncRoteiroStatus(id)));

    // Aviso no Telegram (best-effort): post agendado com data = concluído.
    const dataTxt = dataAgendada.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
    await notifyTelegram(
      `🗓️ <b>Post agendado (concluído)</b>\nCliente: ${tgEscape(item.client?.name)}\nPost: ${tgEscape(item.title || "(sem título)")}\n📅 Programado para ${dataTxt}`
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao marcar como agendado" }, { status: 500 });
  }
}
