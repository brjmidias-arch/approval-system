import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listConteudosDoCliente } from "@/lib/roteirizacao";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { roteiroClienteId: true },
  });
  if (!client?.roteiroClienteId) return NextResponse.json({ conteudos: [], notLinked: true });

  try {
    const conteudos = await listConteudosDoCliente(client.roteiroClienteId);
    return NextResponse.json({ conteudos });
  } catch {
    return NextResponse.json({ error: "Roteirização indisponível" }, { status: 502 });
  }
}
