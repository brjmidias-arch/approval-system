export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import FeedView from "@/components/FeedView";
import FeedClientPicker from "@/components/admin/FeedClientPicker";
import CopyFeedLinkButton from "@/components/admin/CopyFeedLinkButton";
import { buildFeed, feedFromDate, FEED_SELECT } from "@/lib/feed";

/** Prévia do feed do Instagram (interna): todos os posts planejados do cliente, inclusive internos. */
export default async function FeedPage({ searchParams }: { searchParams: { client?: string } }) {
  const clients = await prisma.client.findMany({
    where: { contentItems: { some: {} } },
    select: { id: true, name: true, token: true },
    orderBy: { name: "asc" },
  });
  if (clients.length === 0) {
    return <p className="text-gray-400">Nenhum cliente com posts ainda.</p>;
  }
  const current = clients.find((c) => c.id === searchParams?.client) ?? clients[0];

  const rows = await prisma.contentItem.findMany({
    where: {
      clientId: current.id,
      OR: [{ scheduledDate: { gte: feedFromDate() } }, { scheduledDate: null, status: { not: "PUBLISHED" } }],
    },
    orderBy: { order: "asc" },
    select: FEED_SELECT,
  });
  const entries = buildFeed(rows, "internal");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white">📱 Prévia do feed</h1>
          <p className="text-xs text-gray-500 mt-0.5">Como o perfil vai ficar com os posts planejados (só visualização).</p>
        </div>
        <div className="flex items-center gap-2">
          <CopyFeedLinkButton token={current.token} />
          <FeedClientPicker clients={clients} current={current.id} />
        </div>
      </div>
      <p className="text-[11px] text-gray-500 -mt-3">
        O link do feed mostra ao cliente só os posts que ele já viu (sem os internos).
      </p>
      <FeedView key={current.id} entries={entries} profileName={current.name} />
    </div>
  );
}
