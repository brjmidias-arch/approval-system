import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";
import { designerCoverToken } from "@/lib/designerToken";
import { notifyNextStep } from "@/lib/notifyStep";

// Posts que precisam de capa (etapa "Criar capa"), de TODOS os clientes.
const NEEDS_COVER = {
  status: "APPROVED",
  coverWaived: false,
  coverDriveUrl: null,
  OR: [{ contentType: "REELS" }, { fileType: "VIDEO" }],
};

function extractDriveId(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /\/folders\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  if (params.token !== (await designerCoverToken())) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });
  try {
    const contentItems = await prisma.contentItem.findMany({
      where: NEEDS_COVER,
      orderBy: [{ clientId: "asc" }, { order: "asc" }],
      select: {
        id: true, title: true, caption: true, fileUrl: true, fileType: true, contentType: true, driveUrl: true,
        client: { select: { name: true } },
      },
    });
    return NextResponse.json({ contentItems });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar posts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  if (params.token !== (await designerCoverToken())) return NextResponse.json({ error: "Link não encontrado" }, { status: 404 });

  const body = await req.json();
  const { contentItemId, coverDriveUrl } = body;
  const id = typeof coverDriveUrl === "string" ? extractDriveId(coverDriveUrl.trim()) : null;
  if (!contentItemId || !id) {
    return NextResponse.json({ error: "Link da capa inválido." }, { status: 400 });
  }

  // Gate: item precisa estar realmente na etapa "Criar capa".
  const item = await prisma.contentItem.findFirst({ where: { id: contentItemId, ...NEEDS_COVER }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Post não disponível." }, { status: 404 });

  try {
    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: {
        coverDriveUrl: coverDriveUrl.trim(),
        coverUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
        coverApproved: false,
      },
    });
    await syncRoteiroStatus(contentItemId);
    await notifyNextStep(contentItemId, "🖼️ Designer enviou a capa");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao enviar a capa" }, { status: 500 });
  }
}
