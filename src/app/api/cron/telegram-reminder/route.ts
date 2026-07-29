import { NextRequest, NextResponse } from "next/server";
import { sendPendingDigest } from "@/lib/notifyStep";

// Endpoint manual para disparar o lembrete de pendências no Telegram.
// (O disparo automático diário acontece junto do cron /api/cron/whatsapp-reminder.)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const grupos = await sendPendingDigest();
  return NextResponse.json({ grupos });
}
