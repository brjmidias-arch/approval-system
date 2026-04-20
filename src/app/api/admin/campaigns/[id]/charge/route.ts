import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.update({
    where: { id: params.id },
    data: { lastChargedAt: new Date() },
  });
  return NextResponse.json(campaign);
}
