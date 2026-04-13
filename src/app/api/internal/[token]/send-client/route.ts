import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { internalToken: params.token },
  });

  if (!campaign) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (campaign.status !== "INTERNAL_DONE") {
    return NextResponse.json({ error: "A revisão interna ainda não foi concluída." }, { status: 400 });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "OPEN" },
  });

  return NextResponse.json({ status: updated.status });
}
