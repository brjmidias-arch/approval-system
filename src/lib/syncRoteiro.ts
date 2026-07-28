import { prisma } from "@/lib/prisma";
import { setConteudoStatus } from "@/lib/roteirizacao";

/**
 * Espelha a fase do post na fase de produção (script_tarefa) do roteiro vinculado.
 * Best-effort: NUNCA lança — falha do Roteirização não pode quebrar a aprovação.
 *
 * Mapa (aprovação → script_tarefa do Roteirização):
 *   - cliente/interno pediu ajuste/reprova → "Ajuste na produção"
 *   - CLIENT_REVIEW (aguardando cliente)   → "Aprovação"
 *   - APPROVED (prontos p/ programar)      → "Agendar"
 *   - SCHEDULED (posts programados)        → "Agendado"
 *   - PUBLISHED (concluído)                → "Publicado"
 *   - DRAFT / INTERNAL_REVIEW / INTERNAL_DONE → não mexe (fase pré-cliente fica com o time)
 */
export async function syncRoteiroStatus(contentItemId: string): Promise<void> {
  try {
    const item = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        roteiroConteudoId: true,
        status: true,
        approvalItem: { select: { status: true } },
        internalReviewItem: { select: { status: true } },
      },
    });
    if (!item?.roteiroConteudoId) return;

    const a = item.approvalItem?.status;
    const r = item.internalReviewItem?.status;
    const needsAdjustment = a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED";

    let tarefa: string | null = null;
    if (needsAdjustment) tarefa = "Ajuste na produção";
    else if (item.status === "CLIENT_REVIEW") tarefa = "Aprovação";
    else if (item.status === "APPROVED") tarefa = "Agendar";
    else if (item.status === "SCHEDULED") tarefa = "Agendado";
    else if (item.status === "PUBLISHED") tarefa = "Publicado";

    if (tarefa) await setConteudoStatus(item.roteiroConteudoId, tarefa);
  } catch (e) {
    console.error("syncRoteiroStatus falhou (ignorado):", e);
  }
}
