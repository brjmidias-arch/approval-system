import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientId, name, month, year, expiresAt } = body;

  if (!clientId || !name || !month || !year) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const expires = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const campaign = await prisma.campaign.create({
    data: {
      clientId,
      name,
      month: Number(month),
      year: Number(year),
      expiresAt: expires,
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
