import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRoteiroStatus } from "@/lib/syncRoteiro";
import { notifyTelegram, tgEscape } from "@/lib/telegram";
import { weekKey, weekLabel, weekRelative, compareWeekKeys } from "@/lib/weeks";

/** Posts "Pronto p/ cliente" (INTERNAL_DONE, sem ajuste pendente) do cliente. */
async function readyItems(clientId: string) {
  const rows = await prisma.contentItem.findMany({
    where: { clientId, status: "INTERNAL_DONE" },
    orderBy: { order: "asc" },
    select: {
      id: true, groupId: true, contentType: true, scheduledDate: true,
      approvalItem: { select: { status: true } },
      internalReviewItem: { select: { status: true } },
    },
  });
  return rows.filter((r) => {
    const a = r.approvalItem?.status;
    const i = r.internalReviewItem?.status;
    return !(a === "ADJUSTMENT" || a === "REJECTED" || i === "ADJUSTMENT" || i === "REJECTED");
  });
}

/** Lista as semanas com posts prontos (carrossel = 1 post). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const items = await readyItems(params.id);
  const counts = new Map<string, Set<string>>();
  for (const it of items) {
    const wk = weekKey(it.scheduledDate);
    const set = counts.get(wk) ?? new Set<string>();
    set.add(it.contentType === "CARROSSEL" && it.groupId ? it.groupId : it.id);
    counts.set(wk, set);
  }
  const weeks = Array.from(counts.keys())
    .sort(compareWeekKeys)
    .map((week) => ({ week, label: weekLabel(week), relative: weekRelative(week), count: counts.get(week)!.size }));
  return NextResponse.json({ weeks });
}

/** Envia ao cliente todos os posts prontos de uma semana ({ week: "YYYY-MM-DD" | "sem-data" }). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { week } = await req.json();
  if (typeof week !== "string" || !week) return NextResponse.json({ error: "Semana inválida" }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { name: true } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const items = (await readyItems(params.id)).filter((it) => weekKey(it.scheduledDate) === week);
  if (items.length === 0) return NextResponse.json({ error: "Nenhum post pronto nesta semana" }, { status: 404 });

  const ids = items.map((it) => it.id);
  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.contentItem.updateMany({
        where: { id: { in: ids } },
        data: { status: "CLIENT_REVIEW", sentToProgramacaoAt: null, clientReviewAt: now },
      }),
      ...ids.map((id) =>
        prisma.approvalItem.upsert({
          where: { contentItemId: id },
          // Mantém o comentário de ajuste anterior (resolvido), igual ao "Enviar p/ cliente".
          update: { status: "PENDING", clientCommentResolved: true, reviewedAt: null },
          create: { contentItemId: id, status: "PENDING" },
        }),
      ),
    ]);
  } catch {
    return NextResponse.json({ error: "Erro ao enviar a semana" }, { status: 500 });
  }

  for (const id of ids) await syncRoteiroStatus(id);

  const posts = new Set(items.map((it) => (it.contentType === "CARROSSEL" && it.groupId ? it.groupId : it.id))).size;
  try {
    await notifyTelegram(
      `📤 <b>Semana enviada ao cliente</b>\nCliente: ${tgEscape(client.name)}\nSemana: ${tgEscape(weekLabel(week))}\nPosts: ${posts}`,
    );
  } catch { /* best-effort */ }

  return NextResponse.json({ success: true, posts, label: weekLabel(week) });
}
