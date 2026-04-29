import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {

  const body = await req.json();
  const { items } = body as { items: { id: string; order: number }[] };

  try {
    await Promise.all(
      items.map((item) =>
        prisma.contentItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao reordenar itens" }, { status: 500 });
  }
}
