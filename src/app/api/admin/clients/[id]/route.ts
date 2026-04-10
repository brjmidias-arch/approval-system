import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {

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
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {

  const body = await req.json();
  const { name, email, whatsapp } = body;

  const client = await prisma.client.update({
    where: { id: params.id },
    data: { name, email, whatsapp },
  });

  return NextResponse.json(client);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {

  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
