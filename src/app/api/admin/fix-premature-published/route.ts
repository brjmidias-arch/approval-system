import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== "brjfix2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const published = await prisma.campaign.findMany({
    where: { status: "PUBLISHED" },
    include: {
      contentItems: {
        include: { approvalItem: true },
      },
    },
  });

  const toFix: string[] = [];
  for (const campaign of published) {
    const approved = campaign.contentItems.filter(
      (i) => i.approvalItem?.status === "APPROVED"
    );
    const hasPostedAt = approved.some((i) => i.postedAt);
    const hasScheduledDate = approved.some((i) => i.scheduledDate);
    if (!hasPostedAt && hasScheduledDate) {
      toFix.push(campaign.id);
    }
  }

  if (toFix.length === 0) {
    return NextResponse.json({ fixed: 0, ids: [] });
  }

  await prisma.campaign.updateMany({
    where: { id: { in: toFix } },
    data: { status: "CLOSED" },
  });

  return NextResponse.json({ fixed: toFix.length, ids: toFix });
}
