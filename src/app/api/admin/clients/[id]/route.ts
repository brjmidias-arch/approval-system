import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        campaigns: {
          include: {
            approvalItems: true,
            contentItems: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ error: "Erro ao buscar cliente" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, email, whatsapp } = body;
  try {
    const client = await prisma.client.update({
      where: { id: params.id },
      data: { name, email, whatsapp },
    });
    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.client.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir cliente" }, { status: 500 });
  }
}
