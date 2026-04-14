import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Find PUBLISHED campaigns where all items were posted more than 7 days ago
  const toDelete = await prisma.campaign.findMany({
    where: {
      status: "PUBLISHED",
      contentItems: {
        some: {},
        every: {
          postedAt: { lte: sevenDaysAgo },
        },
      },
    },
    select: { id: true, name: true, client: { select: { name: true } } },
  });

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  await prisma.campaign.deleteMany({
    where: { id: { in: toDelete.map((c) => c.id) } },
  });

  return NextResponse.json({
    deleted: toDelete.length,
    campaigns: toDelete.map((c) => `${c.client.name} — ${c.name}`),
  });
}
