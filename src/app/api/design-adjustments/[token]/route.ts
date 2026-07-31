import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";
import { refreshGroupMediaFromDrive } from "@/lib/driveMedia";
import { designerAdjustToken } from "@/lib/designerToken";
import { notifyNextStep, notifyApprovalStep } from "@/lib/notifyStep";

// Posts com ajuste pedido (cliente OU revisão interna), de TODOS os clientes.
const NEEDS_ADJUSTMENT = {
  OR: [
    { approvalItem: { status: { in: ["ADJUSTMENT", "REJECTED"] } } },
    { internalReviewItem: { status: { in: ["ADJUSTMENT", "REJECTED"] } } },
  ],
};

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  if (params.token !== (await designerAdjustToken())) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  try {
    const rows = await prisma.contentItem.findMany({
      where: NEEDS_ADJUSTMENT,
      orderBy: [{ clientId: "asc" }, { order: "asc" }],
      select: {
        id: true, title: true, caption: true, fileUrl: true, fileType: true, contentType: true, driveUrl: true, groupId: true,
        client: { select: { name: true } },
        approvalItem: { select: { status: true, clientComment: true } },
        internalReviewItem: { select: { status: true, comment: true } },
      },
    });
    // Deduplica por grupo (carrossel = 1 entrada, não 1 por slide).
    const seen = new Set<string>();
    const contentItems = [];
    for (const i of rows) {
      const key = i.groupId ?? i.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = i.approvalItem?.status;
      const r = i.internalReviewItem?.status;
      let ajuste: string | null = null;
      let fonte: "cliente" | "interno" | null = null;
      if (a === "ADJUSTMENT" || a === "REJECTED") { ajuste = i.approvalItem?.clientComment ?? null; fonte = "cliente"; }
      else if (r === "ADJUSTMENT" || r === "REJECTED") { ajuste = i.internalReviewItem?.comment ?? null; fonte = "interno"; }
      contentItems.push({
        id: i.id, title: i.title, caption: i.caption, fileUrl: i.fileUrl, fileType: i.fileType,
        contentType: i.contentType, driveUrl: i.driveUrl, client: i.client, ajuste, fonte,
      });
    }
    return NextResponse.json({ contentItems });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar ajustes" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  if (params.token !== (await designerAdjustToken())) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, driveUrl } = body;
  if (!contentItemId) return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });

  const item = await prisma.contentItem.findFirst({
    where: { id: contentItemId, ...NEEDS_ADJUSTMENT },
    select: { id: true, groupId: true },
  });
  if (!item) return NextResponse.json({ error: "Post não disponível." }, { status: 404 });

  try {
    const ids = item.groupId
      ? (await prisma.contentItem.findMany({ where: { groupId: item.groupId }, select: { id: true } })).map((x) => x.id)
      : [item.id];

    // Novo link do Drive (opcional) no item clicado.
    if (typeof driveUrl === "string" && driveUrl.trim()) {
      await prisma.contentItem.update({ where: { id: contentItemId }, data: { driveUrl: driveUrl.trim() } });
    }

    // "Ajuste feito": volta para Revisão interna e limpa as flags (mantém comentários resolvidos).
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

    // Re-busca a arte do Drive (best-effort) e sincroniza.
    const src = await prisma.contentItem.findUnique({ where: { id: contentItemId }, select: { driveUrl: true } });
    const groupItems = await prisma.contentItem.findMany({ where: { id: { in: ids } }, orderBy: { order: "asc" }, select: { id: true, fileType: true } });
    await refreshGroupMediaFromDrive(src?.driveUrl ?? null, groupItems);
    await Promise.all(ids.map((id) => syncRoteiroStatus(id)));
    await notifyNextStep(contentItemId, "🛠️ Designer fez o ajuste");
    // Grupo de aprovações: post voltou para revisão interna.
    await notifyApprovalStep(contentItemId, "🛠️ Ajuste feito");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao enviar o ajuste" }, { status: 500 });
  }
}
