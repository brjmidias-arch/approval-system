import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";
import { notifyTelegram, tgEscape } from "@/lib/telegram";

const POST_SELECT = {
  id: true, fileUrl: true, fileType: true, contentType: true, title: true, caption: true,
  coverUrl: true, coverDriveUrl: true, driveUrl: true,
} as const;

// Filtro dos posts que aguardam aprovação de capa.
const COVER_PENDING = {
  status: "APPROVED",
  coverApproved: false,
  coverWaived: false,
  coverDriveUrl: { not: null },
  OR: [{ contentType: "REELS" }, { fileType: "VIDEO" }],
};

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const client = await prisma.client.findUnique({ where: { coverToken: params.token }, select: { id: true, name: true } });
    if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
    const contentItems = await prisma.contentItem.findMany({
      where: { clientId: client.id, ...COVER_PENDING },
      orderBy: { order: "asc" },
      select: POST_SELECT,
    });
    return NextResponse.json({ id: client.id, name: client.name, client: { name: client.name }, contentItems });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar capas" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const client = await prisma.client.findUnique({ where: { coverToken: params.token }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, action } = body;
  if (!contentItemId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Campos obrigatórios faltando ou inválidos" }, { status: 400 });
  }

  // IDOR + gate: item precisa ser do cliente E estar aguardando aprovação de capa.
  const item = await prisma.contentItem.findFirst({
    where: { id: contentItemId, clientId: client.id, ...COVER_PENDING },
    select: { id: true, groupId: true, title: true, client: { select: { name: true } } },
  });
  if (!item) return NextResponse.json({ error: "Capa não disponível para aprovação" }, { status: 404 });

  try {
    if (action === "approve") {
      // Capa aprovada → vai para "Prontos p/ programar".
      await prisma.contentItem.update({ where: { id: contentItemId }, data: { coverApproved: true } });
    } else {
      // Reprovada → remove a capa e volta para "Criar capa".
      await prisma.contentItem.update({ where: { id: contentItemId }, data: { coverDriveUrl: null, coverUrl: null, coverApproved: false } });
    }
    await syncRoteiroStatus(contentItemId);

    // Aviso no Telegram (best-effort).
    const nome = tgEscape(item.client?.name);
    const post = tgEscape(item.title || "(sem título)");
    if (action === "approve") {
      await notifyTelegram(`✅ <b>Capa aprovada</b>\nCliente: ${nome}\nPost: ${post}`);
    } else {
      await notifyTelegram(`↩️ <b>Capa reprovada (refazer)</b>\nCliente: ${nome}\nPost: ${post}`);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
