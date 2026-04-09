import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      approvalItems: true,
      contentItems: true,
    },
  });

  if (!campaign) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const total = campaign.contentItems.length;
  const reviewed = campaign.approvalItems.filter((a) => a.status !== "PENDING").length;
  const approved = campaign.approvalItems.filter((a) => a.status === "APPROVED").length;
  const adjustment = campaign.approvalItems.filter((a) => a.status === "ADJUSTMENT").length;
  const rejected = campaign.approvalItems.filter((a) => a.status === "REJECTED").length;

  return NextResponse.json({
    status: campaign.status,
    total,
    reviewed,
    approved,
    adjustment,
    rejected,
    lastUpdated: new Date().toISOString(),
  });
}
