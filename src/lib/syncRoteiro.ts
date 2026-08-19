import { prisma } from "@/lib/prisma";
import { updateRoteiroScript, getConteudo, getPrevisaoByIds } from "@/lib/roteirizacao";

/** "YYYY-MM-DD..." → Date ao meio-dia UTC (evita virar o dia por fuso). null se inválido. */
function parseRotDate(v: string | null): Date | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T12:00:00.000Z`);
}

/**
 * Ao ANEXAR um post a um roteiro: puxa do Roteirização a legenda → caption e a
 * data de previsão de postagem (data_postagem) → scheduledDate (dia a agendar).
 * Best-effort: NUNCA lança. Só sobrescreve quando o Roteirização tem o valor.
 */
export async function pullRoteiroToItem(contentItemId: string): Promise<void> {
  try {
    const item = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: { id: true, groupId: true, roteiroConteudoId: true, caption: true },
    });
    if (!item?.roteiroConteudoId) return;
    const c = await getConteudo(item.roteiroConteudoId);
    if (!c) return;

    // Legenda → caption: só preenche se o post ainda estiver SEM legenda
    // (não sobrescreve o que foi digitado/editado no modal ou depois).
    if (c.legenda && c.legenda.trim() && !item.caption?.trim()) {
      await prisma.contentItem.update({ where: { id: item.id }, data: { caption: c.legenda } });
    }
    // Previsão de postagem → scheduledDate (grupo todo do carrossel).
    const dt = parseRotDate(c.previsao_postagem);
    if (dt) {
      const ids = item.groupId
        ? (await prisma.contentItem.findMany({ where: { groupId: item.groupId }, select: { id: true } })).map((s) => s.id)
        : [item.id];
      await prisma.contentItem.updateMany({ where: { id: { in: ids } }, data: { scheduledDate: dt } });
    }
  } catch (e) {
    console.error("pullRoteiroToItem falhou (ignorado):", e);
  }
}

/**
 * Atualiza a PREVISÃO (scheduledDate) dos posts conectados a partir da data_postagem
 * atual no Roteirização — para refletir mudanças feitas lá. Batched (1 consulta).
 * Best-effort. Retorna a previsão efetiva por id de post ({ postId: Date|null }).
 */
export async function refreshPrevisaoForItems(
  items: { id: string; roteiroConteudoId: string | null; scheduledDate: Date | null }[]
): Promise<Record<string, Date | null>> {
  const eff: Record<string, Date | null> = {};
  for (const it of items) eff[it.id] = it.scheduledDate;
  try {
    const connected = items.filter((i) => i.roteiroConteudoId);
    if (connected.length === 0) return eff;
    const map = await getPrevisaoByIds(connected.map((i) => i.roteiroConteudoId!));
    for (const it of connected) {
      const dp = parseRotDate(map[it.roteiroConteudoId!] ?? null);
      if (!dp) continue; // Roteirização sem data → mantém a previsão atual.
      const same = dp.getTime() === (it.scheduledDate?.getTime() ?? NaN);
      if (!same) {
        await prisma.contentItem.update({ where: { id: it.id }, data: { scheduledDate: dp } });
        eff[it.id] = dp;
      }
    }
  } catch (e) {
    console.error("refreshPrevisaoForItems falhou (ignorado):", e);
  }
  return eff;
}

/** Data de hoje no fuso de Brasília (YYYY-MM-DD). */
function hojeBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function somaDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

/**
 * Espelha a fase do post no roteiro vinculado (rot_scripts). Best-effort: NUNCA lança.
 *
 * Mapa (aprovação → roteirização):
 *   ajuste (cliente/interno) → "Cliente/interno pede ajuste"  | prazo = hoje
 *   INTERNAL_REVIEW          → "Revisão Interna"               | prazo = hoje
 *   CLIENT_REVIEW            → "Aprovação Cliente"             | prazo = hoje
 *   APPROVED                 → "Pronto para programar"         | prazo = amanhã
 *   SCHEDULED / PUBLISHED    → "Concluído"                     | data_postagem = data agendada
 *   DRAFT / INTERNAL_DONE    → não mexe (fica com o time do roteirização)
 */
export async function syncRoteiroStatus(contentItemId: string): Promise<void> {
  try {
    const item = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        roteiroConteudoId: true,
        status: true,
        contentType: true,
        fileType: true,
        scheduledDate: true,
        agendadoDate: true,
        driveUrl: true,
        caption: true,
        coverDriveUrl: true,
        coverWaived: true,
        coverApproved: true,
        approvalItem: { select: { status: true, clientComment: true } },
        internalReviewItem: { select: { status: true, comment: true } },
      },
    });
    if (!item?.roteiroConteudoId) return;

    const a = item.approvalItem?.status;
    const r = item.internalReviewItem?.status;
    const ajusteCliente = a === "ADJUSTMENT" || a === "REJECTED";
    const ajusteInterno = r === "ADJUSTMENT" || r === "REJECTED";
    const needsAdjustment = ajusteCliente || ajusteInterno;

    const fields: {
      script_tarefa?: string;
      prazo_roteiro?: string | null;
      data_postagem?: string | null;
      comentarios?: string | null;
      link_drive?: string;
      legenda?: string;
      link_capa?: string;
      responsavel?: string;
    } = {};

    // Chave de responsável desta fase (ver tabela ResponsavelRoteiro, editável).
    let respKey: string | null = null;
    const isVideo = item.contentType === "REELS" || item.fileType === "VIDEO";

    // Empurra artefatos de produção do post → roteiro (só quando o post tem o valor).
    if (item.driveUrl) fields.link_drive = item.driveUrl;
    if (item.caption) fields.legenda = item.caption;
    if (item.coverDriveUrl) fields.link_capa = item.coverDriveUrl;

    if (needsAdjustment) {
      fields.script_tarefa = "Cliente/interno pede ajuste";
      fields.prazo_roteiro = hojeBR();
      respKey = isVideo ? "ajusteVideo" : "ajusteOutro";
      // Descrição do status = o ajuste pedido (cliente tem precedência sobre interno).
      const quem = ajusteCliente ? "Cliente" : "Interno";
      const texto = ajusteCliente ? item.approvalItem?.clientComment : item.internalReviewItem?.comment;
      fields.comentarios = texto ? `✏️ ${quem} pediu ajuste: ${texto}` : `✏️ ${quem} pediu ajuste`;
    } else if (item.status === "INTERNAL_REVIEW") {
      fields.script_tarefa = "Revisão Interna";
      fields.prazo_roteiro = hojeBR();
      respKey = "revisaoInterna";
    } else if (item.status === "CLIENT_REVIEW") {
      fields.script_tarefa = "Aprovação Cliente";
      fields.prazo_roteiro = hojeBR();
    } else if (item.status === "APPROVED") {
      // Aprovado pelo cliente: se é vídeo SEM capa → "Criar Capa" (design); senão → programar.
      // Fica em "Criar Capa" enquanto for vídeo, não dispensado, e a capa ainda
      // não estiver adicionada E aprovada.
      const semCapa = isVideo && !item.coverWaived && (!item.coverDriveUrl || !item.coverApproved);
      if (semCapa) {
        fields.script_tarefa = "Criar Capa";
        fields.prazo_roteiro = hojeBR();
        respKey = "criarCapa";
      } else {
        fields.script_tarefa = "Pronto para programar";
        fields.prazo_roteiro = somaDias(hojeBR(), 1);
        respKey = "prontoProgramar";
      }
    } else if (item.status === "SCHEDULED" || item.status === "PUBLISHED") {
      fields.script_tarefa = "Concluído";
      // data_postagem = data agendada de fato (agendadoDate); se não houver, a previsão.
      const dataFinal = item.agendadoDate ?? item.scheduledDate;
      if (dataFinal) fields.data_postagem = dataFinal.toISOString().slice(0, 10);
    }

    // Fora de ajuste: limpa a descrição (só mexe se estamos sincronizando esta fase).
    if (!needsAdjustment && fields.script_tarefa) fields.comentarios = null;

    // Responsável configurável por fase (tabela ResponsavelRoteiro).
    if (respKey) {
      const cfg = await prisma.responsavelRoteiro.findUnique({ where: { chave: respKey } });
      if (cfg?.nome) fields.responsavel = cfg.nome;
    }

    if (Object.keys(fields).length > 0) {
      await updateRoteiroScript(item.roteiroConteudoId, fields);
    }
  } catch (e) {
    console.error("syncRoteiroStatus falhou (ignorado):", e);
  }
}
