import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data: { status: "OPEN" },
      include: { client: true },
    });

    // Send WhatsApp to client group (non-blocking)
    if (campaign.client.whatsapp) {
      try {
        const approvalUrl = `${process.env.NEXTAUTH_URL}/aprovar/${campaign.token}`;
        const deadline = new Date(campaign.expiresAt).toLocaleDateString("pt-BR");
        const msg =
          `Olá, ${campaign.client.name}! 🎨\n\n` +
          `O conteúdo de *${campaign.name}* está pronto para revisão.\n\n` +
          `Acesse o link abaixo para aprovar ou solicitar ajustes:\n${approvalUrl}\n\n` +
          `Prazo: ${deadline} — _BRJ Mídias_`;
        await sendWhatsApp(campaign.client.whatsapp, msg);
      } catch (err) {
        console.error("Erro ao enviar WhatsApp:", err);
      }
    }

    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Erro ao enviar para cliente" }, { status: 500 });
  }
}
