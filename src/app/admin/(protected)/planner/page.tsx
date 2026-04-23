export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import PlannerCalendar from "@/components/admin/PlannerCalendar";

export default async function PlannerPage() {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const campaigns = await prisma.campaign.findMany({
    include: {
      client: true,
      contentItems: {
        where: {
          approvalItem: { status: "APPROVED" },
          OR: [
            { scheduledDate: null },
            { scheduledDate: { gte: oneMonthAgo } },
          ],
        },
        orderBy: { order: "asc" },
        include: { approvalItem: true },
      },
    },
  });

  const seenGroupIds = new Set<string>();
  const posts: {
    id: string;
    title: string | null;
    contentType: string;
    fileUrl: string;
    fileType: string;
    coverUrl: string | null;
    caption: string | null;
    scheduledDate: string | null;
    clientName: string;
    campaignName: string;
    campaignId: string;
  }[] = [];

  for (const campaign of campaigns) {
    for (const item of campaign.contentItems) {
      if (item.contentType === "CARROSSEL" && item.groupId) {
        if (seenGroupIds.has(item.groupId)) continue;
        seenGroupIds.add(item.groupId);
      }
      posts.push({
        id: item.id,
        title: item.title,
        contentType: item.contentType,
        fileUrl: item.fileUrl,
        fileType: item.fileType,
        coverUrl: item.coverUrl,
        caption: item.caption,
        scheduledDate: item.scheduledDate ? item.scheduledDate.toISOString() : null,
        clientName: campaign.client.name,
        campaignName: campaign.name,
        campaignId: campaign.id,
      });
    }
  }

  return <PlannerCalendar initialPosts={posts} />;
}
