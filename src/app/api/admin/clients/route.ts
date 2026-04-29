import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        campaigns: {
          include: {
            approvalItems: true,
            contentItems: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(clients);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar clientes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, whatsapp } = body;

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  try {
    const client = await prisma.client.create({
      data: { name, email, whatsapp },
    });
    return NextResponse.json(client, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
  }
}
