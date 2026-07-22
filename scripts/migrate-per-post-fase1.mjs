// Fase 1 — backfill idempotente para o modelo por post.
// Preenche Client.token/internalToken, ContentItem.clientId e ContentItem.status.
// Status por post; carrossel deduzido pelo primeiro slide (menor order) e aplicado a todos.
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// Deduz o status do post. IMPORTANTE: como todo item ganha um ApprovalItem na criação,
// a mera existência dele NÃO significa "enviado ao cliente" — o sinal real da etapa é o
// status da campanha. Client-approved (approvalItem APPROVED) e postado vencem tudo.
function deriveStatus(item, campaignStatus) {
  if (item.postedAt) return "PUBLISHED";
  if (item.approvalItem?.status === "APPROVED") return "APPROVED";
  switch (campaignStatus) {
    case "DRAFT":
      return "DRAFT";
    case "INTERNAL_REVIEW":
      return "INTERNAL_REVIEW";
    case "INTERNAL_DONE":
      // lote revisado internamente; item internamente aprovado mas ainda não enviado ao cliente
      return item.internalReviewItem?.status === "APPROVED" ? "INTERNAL_DONE" : "INTERNAL_REVIEW";
    case "OPEN":
    case "CLOSED":
    case "PUBLISHED":
      // enviado ao cliente; item ainda escondido pela revisão interna fica em revisão interna
      if (item.internalReviewItem && item.internalReviewItem.status !== "APPROVED") return "INTERNAL_REVIEW";
      return "CLIENT_REVIEW";
    default:
      return "DRAFT";
  }
}

async function main() {
  // 1) Tokens por cliente (só onde faltar)
  const clients = await prisma.client.findMany({ select: { id: true, token: true, internalToken: true } });
  let tokensSet = 0;
  for (const c of clients) {
    const data = {};
    if (!c.token) data.token = randomUUID();
    if (!c.internalToken) data.internalToken = randomUUID();
    if (Object.keys(data).length) { await prisma.client.update({ where: { id: c.id }, data }); tokensSet++; }
  }
  console.log(`clientes com token preenchido: ${tokensSet}/${clients.length}`);

  // 2) clientId + status por post (carrossel uniforme por grupo)
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true, clientId: true, status: true,
      contentItems: {
        select: {
          id: true, groupId: true, contentType: true, order: true, postedAt: true,
          approvalItem: { select: { status: true } },
          internalReviewItem: { select: { status: true } },
        },
      },
    },
  });

  let itemsUpdated = 0;
  for (const camp of campaigns) {
    const sorted = [...camp.contentItems].sort((a, b) => a.order - b.order);
    // representante por chave (carrossel: groupId; single: id)
    const statusByKey = new Map();
    for (const it of sorted) {
      const key = it.contentType === "CARROSSEL" && it.groupId ? `g:${it.groupId}` : `i:${it.id}`;
      if (!statusByKey.has(key)) statusByKey.set(key, deriveStatus(it, camp.status)); // primeiro (menor order) = representante
    }
    for (const it of camp.contentItems) {
      const key = it.contentType === "CARROSSEL" && it.groupId ? `g:${it.groupId}` : `i:${it.id}`;
      const status = statusByKey.get(key);
      await prisma.contentItem.update({ where: { id: it.id }, data: { clientId: camp.clientId, status } });
      itemsUpdated++;
    }
  }
  console.log(`posts atualizados (clientId+status): ${itemsUpdated}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
