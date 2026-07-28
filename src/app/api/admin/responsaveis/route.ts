import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const itens = await prisma.responsavelRoteiro.findMany({ orderBy: { chave: "asc" } });
  return NextResponse.json({ itens });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  const itens: { chave: string; nome: string }[] = body.itens ?? [];
  try {
    for (const { chave, nome } of itens) {
      await prisma.responsavelRoteiro.update({ where: { chave }, data: { nome: nome || "" } });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
