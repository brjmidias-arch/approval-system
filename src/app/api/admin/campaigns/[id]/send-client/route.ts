import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data: { status: "OPEN" },
    });
    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Erro ao enviar para cliente" }, { status: 500 });
  }
}
