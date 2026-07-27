import { prisma } from "@/lib/prisma";
import { setConteudoStatus } from "@/lib/roteirizacao";

/**
 * Espelha o estado do post na peça vinculada do Roteirização.
 * Best-effort: NUNCA lança — falha do Roteirização não pode quebrar a aprovação.
 * Mapeamento (reaproveitando os 4 status do Roteirização):
 *   - cliente OU interno pediu ajuste/reprova → "ajuste"
 *   - caso contrário (em produção/aprovado/publicado) → "aprovado"
 */
export async function syncRoteiroStatus(contentItemId: string): Promise<void> {
  try {
    const item = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        roteiroConteudoId: true,
        approvalItem: { select: { status: true } },
        internalReviewItem: { select: { status: true } },
      },
    });
    if (!item?.roteiroConteudoId) return;

    const a = item.approvalItem?.status;
    const r = item.internalReviewItem?.status;
    const needsAdjustment = a === "ADJUSTMENT" || a === "REJECTED" || r === "ADJUSTMENT" || r === "REJECTED";

    await setConteudoStatus(item.roteiroConteudoId, needsAdjustment ? "ajuste" : "aprovado");
  } catch (e) {
    console.error("syncRoteiroStatus falhou (ignorado):", e);
  }
}
