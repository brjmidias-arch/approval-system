export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CopyButton from "@/components/admin/CopyButton";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
};

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export default async function ProgramacaoPage() {
  // Get all campaigns with fully approved posts
  const campaigns = await prisma.campaign.findMany({
    include: {
      client: true,
      contentItems: {
        orderBy: { order: "asc" },
        include: { approvalItem: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter: campaigns that have at least one approved post
  type CampaignWithItems = (typeof campaigns)[0];

  function getApprovedGroups(campaign: CampaignWithItems) {
    const seenGroupIds = new Set<string>();
    const groups: {
      id: string;
      groupId: string | null;
      title: string | null;
      caption: string | null;
      driveUrl: string | null;
      coverUrl: string | null;
      coverDriveUrl: string | null;
      scheduledDate: Date | null;
      contentType: string;
      fileType: string;
      fileUrl: string;
    }[] = [];

    for (const item of campaign.contentItems) {
      if (item.approvalItem?.status !== "APPROVED") continue;

      if (item.contentType === "CARROSSEL" && item.groupId) {
        if (seenGroupIds.has(item.groupId)) continue;
        seenGroupIds.add(item.groupId);
        groups.push({
          id: item.id,
          groupId: item.groupId,
          title: item.title,
          caption: item.caption,
          driveUrl: item.driveUrl,
          coverUrl: item.coverUrl,
          coverDriveUrl: item.coverDriveUrl,
          scheduledDate: item.scheduledDate,
          contentType: item.contentType,
          fileType: item.fileType,
          fileUrl: item.fileUrl,
        });
      } else if (item.contentType !== "CARROSSEL") {
        groups.push({
          id: item.id,
          groupId: null,
          title: item.title,
          caption: item.caption,
          driveUrl: item.driveUrl,
          coverUrl: item.coverUrl,
          coverDriveUrl: item.coverDriveUrl,
          scheduledDate: item.scheduledDate,
          contentType: item.contentType,
          fileType: item.fileType,
          fileUrl: item.fileUrl,
        });
      }
    }

    return groups;
  }

  const readyCampaigns = campaigns
    .map((c) => ({ campaign: c, posts: getApprovedGroups(c) }))
    .filter(({ posts }) => posts.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Programação</h1>
          <p className="text-gray-400 text-sm mt-0.5">Posts aprovados prontos para agendar</p>
        </div>
      </div>

      {readyCampaigns.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-10 text-center">
          <p className="text-2xl mb-3">📅</p>
          <p className="text-gray-400">Nenhum post aprovado ainda.</p>
          <p className="text-gray-600 text-sm mt-1">Posts aparecem aqui quando o cliente aprovar.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {readyCampaigns.map(({ campaign, posts }) => (
            <div key={campaign.id} className="space-y-3">
              {/* Campaign header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-medium">{campaign.name}</h2>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {campaign.client.name} · {MONTHS[campaign.month - 1]} {campaign.year}
                  </p>
                </div>
                <Link
                  href={`/admin/campaigns/${campaign.id}`}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Ver campanha →
                </Link>
              </div>

              {/* Posts grid */}
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-[#1a1a1a] border border-emerald-500/20 rounded-xl overflow-hidden"
                  >
                    <div className="flex items-start gap-4 p-4">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                        {post.fileType === "IMAGE" ? (
                          <img src={post.fileUrl} alt="" className="w-full h-full object-cover" />
                        ) : post.fileType === "VIDEO" ? (
                          <span className="text-2xl">🎬</span>
                        ) : (
                          <span className="text-2xl">📄</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {post.title && (
                            <span className="text-white text-sm font-medium">{post.title}</span>
                          )}
                          <span className="text-xs font-medium text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded">
                            {CONTENT_TYPE_LABELS[post.contentType] || post.contentType}
                          </span>
                          {post.scheduledDate && (
                            <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                              📅 {new Date(post.scheduledDate).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          <span className="text-xs text-emerald-400">✅ Aprovado</span>
                        </div>

                        {/* Drive links */}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {post.driveUrl ? (
                            <a href={post.driveUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                              🔗 Arquivo no Drive
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600 inline-block self-center">Sem link do Drive</span>
                          )}
                          {post.contentType === "REELS" && post.coverDriveUrl && (
                            <a href={post.coverDriveUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-900/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors">
                              🖼️ Capa no Drive
                            </a>
                          )}
                        </div>

                        {/* Cover preview */}
                        {post.contentType === "REELS" && post.coverUrl && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Capa do Reels</p>
                            <img src={post.coverUrl} alt="Capa" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Caption */}
                    {post.caption && (
                      <div className="border-t border-white/5 px-4 py-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Legenda</p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                        <CopyButton text={post.caption} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
