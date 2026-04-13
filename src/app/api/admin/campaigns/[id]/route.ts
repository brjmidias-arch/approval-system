import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {

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
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {

  const body = await req.json();
  const { name, month, year, expiresAt, status } = body;

  const campaign = await prisma.campaign.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(month && { month: Number(month) }),
      ...(year && { year: Number(year) }),
      ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      ...(status && { status }),
    },
  });

  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {

  await prisma.campaign.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
