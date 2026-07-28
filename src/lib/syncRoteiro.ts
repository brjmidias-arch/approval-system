import { prisma } from "@/lib/prisma";
import { updateRoteiroScript } from "@/lib/roteirizacao";

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
        scheduledDate: true,
        driveUrl: true,
        caption: true,
        coverDriveUrl: true,
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
    } = {};

    // Empurra artefatos de produção do post → roteiro (só quando o post tem o valor).
    if (item.driveUrl) fields.link_drive = item.driveUrl;
    if (item.caption) fields.legenda = item.caption;

    if (needsAdjustment) {
      fields.script_tarefa = "Cliente/interno pede ajuste";
      fields.prazo_roteiro = hojeBR();
      // Descrição do status = o ajuste pedido (cliente tem precedência sobre interno).
      const quem = ajusteCliente ? "Cliente" : "Interno";
      const texto = ajusteCliente ? item.approvalItem?.clientComment : item.internalReviewItem?.comment;
      fields.comentarios = texto ? `✏️ ${quem} pediu ajuste: ${texto}` : `✏️ ${quem} pediu ajuste`;
    } else if (item.status === "INTERNAL_REVIEW") {
      fields.script_tarefa = "Revisão Interna";
      fields.prazo_roteiro = hojeBR();
    } else if (item.status === "CLIENT_REVIEW") {
      fields.script_tarefa = "Aprovação Cliente";
      fields.prazo_roteiro = hojeBR();
    } else if (item.status === "APPROVED") {
      fields.script_tarefa = "Pronto para programar";
      fields.prazo_roteiro = somaDias(hojeBR(), 1);
    } else if (item.status === "SCHEDULED" || item.status === "PUBLISHED") {
      fields.script_tarefa = "Concluído";
      if (item.scheduledDate) fields.data_postagem = item.scheduledDate.toISOString().slice(0, 10);
    }

    // Fora de ajuste: limpa a descrição (só mexe se estamos sincronizando esta fase).
    if (!needsAdjustment && fields.script_tarefa) fields.comentarios = null;

    if (Object.keys(fields).length > 0) {
      await updateRoteiroScript(item.roteiroConteudoId, fields);
    }
  } catch (e) {
    console.error("syncRoteiroStatus falhou (ignorado):", e);
  }
}
