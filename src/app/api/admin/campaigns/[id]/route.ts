import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        contentItems: {
          orderBy: { order: "asc" },
          include: { approvalItem: true, internalReviewItem: true },
        },
      },
    });
    if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar campanha" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, month, year, expiresAt, status } = body;
  const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(month && { month: Number(month) }),
        ...(year && { year: Number(year) }),
        ...(status === "OPEN" ? { expiresAt: oneDayFromNow } : expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        ...(status && { status }),
      },
    });
    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar campanha" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.campaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir campanha" }, { status: 500 });
  }
}
