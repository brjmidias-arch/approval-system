import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await req.json();
  if (!groupId || !groupId.includes("@g.us")) {
    return NextResponse.json({ error: "JID inválido. Deve terminar em @g.us" }, { status: 400 });
  }

  try {
    await sendWhatsApp(
      groupId,
      "✅ *Teste de conexão — BRJ Mídias*\n\nEste grupo está corretamente vinculado ao sistema de aprovação de conteúdo."
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
