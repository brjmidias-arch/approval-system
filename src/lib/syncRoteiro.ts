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
        contentType: true,
        fileType: true,
        scheduledDate: true,
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
      if (item.scheduledDate) fields.data_postagem = item.scheduledDate.toISOString().slice(0, 10);
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
