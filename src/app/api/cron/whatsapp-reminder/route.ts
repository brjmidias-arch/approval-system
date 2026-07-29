import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendPendingDigest } from "@/lib/notifyStep";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all OPEN campaigns whose clients have a WhatsApp number
  const campaigns = await prisma.campaign.findMany({
    where: { status: "OPEN" },
    include: { client: true },
  });

  const results: { campaignId: string; clientName: string; sent: boolean; error?: string }[] = [];

  for (const campaign of campaigns) {
    if (!campaign.client.whatsapp) continue;

    const approvalUrl = `${process.env.NEXTAUTH_URL}/aprovar/${campaign.token}`;
    const msg =
      `Lembrete BRJ Mídias 📋\n\n` +
      `Olá, ${campaign.client.name}! A campanha *${campaign.name}* ainda aguarda sua aprovação.\n\n` +
      `Acesse o link abaixo para revisar o conteúdo:\n${approvalUrl}\n\n` +
      `_BRJ Mídias — Sistema de Aprovação_`;

    try {
      await sendWhatsApp(campaign.client.whatsapp, msg);
      results.push({ campaignId: campaign.id, clientName: campaign.client.name, sent: true });
    } catch (err) {
      results.push({
        campaignId: campaign.id,
        clientName: campaign.client.name,
        sent: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Lembrete diário de pendências no Telegram (best-effort).
  await sendPendingDigest();

  return NextResponse.json({ sent: results.filter((r) => r.sent).length, results });
}
