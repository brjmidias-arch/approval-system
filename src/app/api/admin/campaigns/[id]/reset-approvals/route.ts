import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
