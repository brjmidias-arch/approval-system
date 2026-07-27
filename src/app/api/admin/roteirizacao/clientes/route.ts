import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listClientesRot } from "@/lib/roteirizacao";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const clientes = await listClientesRot();
    return NextResponse.json({ clientes });
  } catch {
    return NextResponse.json({ error: "Roteirização indisponível" }, { status: 502 });
  }
}
