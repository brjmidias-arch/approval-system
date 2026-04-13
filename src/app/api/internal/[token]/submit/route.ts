import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { internalToken: params.token },
    include: {
      contentItems: {
        include: { internalReviewItem: true },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const items = campaign.contentItems;
  const approved = items.filter((i) => i.internalReviewItem?.status === "APPROVED").length;
  const adjustment = items.filter((i) => i.internalReviewItem?.status === "ADJUSTMENT").length;
  const rejected = items.filter((i) => i.internalReviewItem?.status === "REJECTED").length;

  // Mark campaign as internally reviewed
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "INTERNAL_REVIEW" },
  });

  return NextResponse.json({ approved, adjustment, rejected });
}
