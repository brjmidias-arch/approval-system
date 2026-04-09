import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.contentItem.findUnique({
    where: { id: params.itemId },
  });

  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // Try to delete the file from disk
  if (item.fileUrl.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", item.fileUrl);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may already be deleted, ignore
    }
  }

  await prisma.contentItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ success: true });
}
