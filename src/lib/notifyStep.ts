import { prisma } from "@/lib/prisma";
import { notifyTelegram, tgEscape } from "@/lib/telegram";
import { designerCoverToken, designerAdjustToken } from "@/lib/designerToken";

const BASE = process.env.NEXTAUTH_URL || "";

export type StepItem = {
  status: string;
  contentType: string;
  fileType: string;
  coverDriveUrl: string | null;
  coverWaived: boolean;
  coverApproved: boolean;
  approvalItem: { status: string } | null;
  internalReviewItem: { status: string } | null;
};

// Rótulos das etapas.
const L_AJUSTE = "✏️ Precisa de ajuste";
const L_CRIAR_CAPA = "🎨 Precisa criar a capa";
const L_APROVAR_CAPA = "🖼️ Capa aguardando aprovação";
const L_INTERNA = "🔍 Aguardando revisão interna";
const L_CLIENTE = "👤 Aguardando aprovação do cliente";
const L_PROGRAMAR = "📅 Pronto para programar";
const L_PROGRAMADO = "🗓️ Programado";

/** Rótulo do próximo passo a partir do estado do post (espelha as etapas do dashboard). */
export function nextStepLabel(i: StepItem): string | null {
  const isVideo = i.contentType === "REELS" || i.fileType === "VIDEO";
  const a = i.approvalItem?.status;
  const r = i.internalReviewItem?.status;
  const needsAdjustment = a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED";
  if (needsAdjustment) return L_AJUSTE;
  switch (i.status) {
    case "INTERNAL_REVIEW":
    case "INTERNAL_DONE":
      return L_INTERNA;
    case "CLIENT_REVIEW":
      return L_CLIENTE;
    case "APPROVED":
      if (isVideo && !i.coverDriveUrl && !i.coverWaived) return L_CRIAR_CAPA;
      if (isVideo && i.coverDriveUrl && !i.coverApproved && !i.coverWaived) return L_APROVAR_CAPA;
      return L_PROGRAMAR;
    case "SCHEDULED":
      return L_PROGRAMADO;
    default:
      return null; // DRAFT/PUBLISHED
  }
}

type LinkCtx = {
  clientId: string;
  itemId: string;
  token: string | null;
  internalToken: string | null;
  coverToken: string | null;
  designerCover: string;
};

/** Só a URL da etapa. */
function stepUrl(label: string, c: LinkCtx): string {
  switch (label) {
    case L_CLIENTE: return `${BASE}/aprovar/${c.token}`;
    case L_INTERNA: return `${BASE}/revisar/${c.internalToken}`;
    case L_CRIAR_CAPA: return `${BASE}/criar-capa/${c.designerCover}`;
    case L_APROVAR_CAPA: return `${BASE}/capa/${c.coverToken}`;
    case L_PROGRAMAR: return `${BASE}/programar/${c.clientId}`;
    case L_AJUSTE: return `${BASE}/post/${c.itemId}`;
    default: return "";
  }
}

/** Linha formatada com o link (e texto pronto) da etapa, para enviar ao cliente/designer. */
function linkLine(label: string, c: LinkCtx): string {
  const url = stepUrl(label, c);
  if (!url) return "";
  switch (label) {
    case L_CLIENTE:
      return `👤 Link de aprovação: ${url}\n💬 Msg p/ o cliente: Olá! 😊 Temos conteúdo pronto pra sua aprovação. É rápido — abra o link, veja cada post e toque em *Aprovar* ✅ ou peça um *Ajuste* ✏️ 👉 ${url}`;
    case L_INTERNA: return `🔍 Revisão interna: ${url}`;
    case L_CRIAR_CAPA: return `🎨 Link do designer (capas): ${url}`;
    case L_APROVAR_CAPA: return `🖼️ Aprovar a capa: ${url}`;
    case L_PROGRAMAR: return `📅 Programar: ${url}`;
    case L_AJUSTE: return `✏️ Post p/ o designer: ${url}`;
    default: return "";
  }
}

type RespCfg = Record<string, string>;

/** Carrega o config de responsáveis por fase (chave → nome). */
export async function loadResponsaveis(): Promise<RespCfg> {
  try {
    const rows = await prisma.responsavelRoteiro.findMany();
    const cfg: RespCfg = {};
    for (const r of rows) if (r.nome) cfg[r.chave] = r.nome;
    return cfg;
  } catch {
    return {};
  }
}

/** Responsável da etapa (para o vídeo, o ajuste vai para ajusteVideo; senão ajusteOutro). */
function responsavelFor(cfg: RespCfg, label: string, isVideo: boolean): string | null {
  switch (label) {
    case L_INTERNA: return cfg.revisaoInterna || null;
    case L_CRIAR_CAPA: return cfg.criarCapa || null;
    case L_APROVAR_CAPA: return cfg.criarCapa || null;
    case L_PROGRAMAR: return cfg.prontoProgramar || null;
    case L_AJUSTE: return (isVideo ? cfg.ajusteVideo : cfg.ajusteOutro) || null;
    default: return null;
  }
}

/**
 * Avisa no Telegram o PRÓXIMO PASSO de um post, já com o link certo (aprovação do
 * cliente, revisão interna, criar/aprovar capa, programar). `prefix` descreve o que
 * acabou de acontecer (ex.: "✅ Cliente aprovou"). Best-effort.
 */
export async function notifyNextStep(contentItemId: string, prefix?: string): Promise<void> {
  try {
    const i = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        id: true, title: true, status: true, contentType: true, fileType: true,
        coverDriveUrl: true, coverWaived: true, coverApproved: true, clientId: true,
        client: { select: { name: true, token: true, internalToken: true, coverToken: true } },
        approvalItem: { select: { status: true } },
        internalReviewItem: { select: { status: true } },
      },
    });
    if (!i) return;
    const label = nextStepLabel(i);
    if (!label && !prefix) return;
    const head = [prefix, label].filter(Boolean).join(" → ");
    let msg = `${head}\nCliente: ${tgEscape(i.client?.name)}\nPost: ${tgEscape(i.title || "(sem título)")}`;
    if (label) {
      const isVideo = i.contentType === "REELS" || i.fileType === "VIDEO";
      const resp = responsavelFor(await loadResponsaveis(), label, isVideo);
      if (resp) msg += `\nResponsável: ${tgEscape(resp)}`;
      const line = linkLine(label, {
        clientId: i.clientId ?? "",
        itemId: i.id,
        token: i.client?.token ?? null,
        internalToken: i.client?.internalToken ?? null,
        coverToken: i.client?.coverToken ?? null,
        designerCover: await designerCoverToken(),
      });
      if (line) msg += `\n\n${line}`;
    }
    await notifyTelegram(msg);
  } catch {
    // best-effort
  }
}

const ORDER = [L_AJUSTE, L_CRIAR_CAPA, L_APROVAR_CAPA, L_INTERNA, L_CLIENTE, L_PROGRAMAR, L_PROGRAMADO];

type DigestItem = {
  id: string;
  title: string | null;
  status: string;
  contentType: string;
  fileType: string;
  coverDriveUrl: string | null;
  coverWaived: boolean;
  coverApproved: boolean;
  clientId: string | null;
  groupId: string | null;
  client: { name: string; token: string | null; internalToken: string | null; coverToken: string | null } | null;
  approvalItem: { status: string } | null;
  internalReviewItem: { status: string } | null;
};

/**
 * Digest diário no Telegram: pendências agrupadas por próximo passo, cada uma com
 * o link para acionar (cliente/designer/programação). Best-effort.
 */
export async function sendPendingDigest(): Promise<number> {
  try {
    const rows = (await prisma.contentItem.findMany({
      where: { status: { in: ["INTERNAL_REVIEW", "INTERNAL_DONE", "CLIENT_REVIEW", "APPROVED"] } },
      orderBy: [{ clientId: "asc" }, { order: "asc" }],
      select: {
        id: true, title: true, status: true, contentType: true, fileType: true,
        coverDriveUrl: true, coverWaived: true, coverApproved: true, clientId: true, groupId: true,
        client: { select: { name: true, token: true, internalToken: true, coverToken: true } },
        approvalItem: { select: { status: true } },
        internalReviewItem: { select: { status: true } },
      },
    })) as DigestItem[];

    // Deduplica por grupo (carrossel = 1 post, não 1 por slide).
    const seenGroup = new Set<string>();
    const items: DigestItem[] = [];
    for (const it of rows) {
      const key = it.groupId ?? it.id;
      if (seenGroup.has(key)) continue;
      seenGroup.add(key);
      items.push(it);
    }

    const byLabel = new Map<string, DigestItem[]>();
    for (const it of items) {
      const label = nextStepLabel(it);
      if (!label) continue;
      const arr = byLabel.get(label) ?? [];
      arr.push(it);
      byLabel.set(label, arr);
    }
    if (byLabel.size === 0) return 0;

    const labels = ORDER.filter((l) => byLabel.has(l));
    const designerCover = await designerCoverToken();
    const designerAdjust = await designerAdjustToken();
    const resp = await loadResponsaveis();
    let msg = "⏰ <b>Lembrete diário — pendências</b>";

    for (const label of labels) {
      const group = byLabel.get(label)!;
      const catResp = label !== L_AJUSTE ? responsavelFor(resp, label, false) : null;
      msg += `\n\n${label}: <b>${group.length}</b>${catResp ? ` — Resp.: ${tgEscape(catResp)}` : ""}`;

      if (label === L_CRIAR_CAPA) {
        // Link único do designer com todos os vídeos que precisam de capa.
        const nomes = Array.from(new Set(group.map((g) => g.client?.name || "?"))).map(tgEscape).join(", ");
        msg += `\n${BASE}/criar-capa/${designerCover}\nClientes: ${nomes}`;
      } else if (label === L_AJUSTE) {
        // Link único do designer com todos os ajustes + lista dos posts (com responsável).
        msg += `\n${BASE}/ajustes/${designerAdjust}`;
        for (const it of group) {
          const r = responsavelFor(resp, L_AJUSTE, it.contentType === "REELS" || it.fileType === "VIDEO");
          msg += `\n• ${tgEscape(it.client?.name)} — ${tgEscape(it.title || "(sem título)")}${r ? ` (${tgEscape(r)})` : ""}`;
        }
      } else {
        // Um link por cliente.
        const seen = new Set<string>();
        for (const it of group) {
          const cid = it.clientId ?? it.id;
          if (seen.has(cid)) continue;
          seen.add(cid);
          const url = stepUrl(label, {
            clientId: it.clientId ?? "",
            itemId: it.id,
            token: it.client?.token ?? null,
            internalToken: it.client?.internalToken ?? null,
            coverToken: it.client?.coverToken ?? null,
            designerCover,
          });
          msg += `\n• ${tgEscape(it.client?.name)}: ${url}`;
        }
      }
    }

    await notifyTelegram(msg);
    return labels.length;
  } catch {
    return 0;
  }
}
