import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendApprovalNotification } from "@/lib/mail";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { token: params.token },
    include: {
      client: true,
      contentItems: {
        include: { approvalItem: true },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (campaign.status === "CLOSED") {
    return NextResponse.json({ error: "Campanha já encerrada" }, { status: 403 });
  }

  const approvalItems = campaign.contentItems.map((item) => item.approvalItem);
  const allReviewed = approvalItems.every((a) => a && a.status !== "PENDING");

  if (!allReviewed) {
    return NextResponse.json({ error: "Todos os itens devem ser revisados antes de enviar" }, { status: 400 });
  }

  // Close the campaign
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "CLOSED" },
  });

  const approved = approvalItems.filter((a) => a?.status === "APPROVED").length;
  const adjustment = approvalItems.filter((a) => a?.status === "ADJUSTMENT").length;
  const rejected = approvalItems.filter((a) => a?.status === "REJECTED").length;

  // Send email notification (non-blocking)
  try {
    await sendApprovalNotification({
      clientName: campaign.client.name,
      campaignName: campaign.name,
      approved,
      adjustment,
      rejected,
      items: campaign.contentItems.map((item) => ({
        caption: item.caption,
        contentType: item.contentType,
        status: item.approvalItem?.status || "PENDING",
        clientComment: item.approvalItem?.clientComment || null,
      })),
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err);
  }

  return NextResponse.json({ success: true, approved, adjustment, rejected });
}
