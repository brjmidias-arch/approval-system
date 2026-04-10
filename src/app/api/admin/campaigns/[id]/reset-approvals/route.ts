import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {

  await prisma.approvalItem.updateMany({
    where: { campaignId: params.id },
    data: { status: "PENDING", clientComment: null, reviewedAt: null },
  });

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "OPEN" },
  });

  return NextResponse.json({ success: true });
}
