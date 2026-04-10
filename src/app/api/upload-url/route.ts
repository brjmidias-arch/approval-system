import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "IMAGE",
  "image/jpg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "video/mp4": "VIDEO",
  "application/pdf": "PDF",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { contentType, fileName } = body;

  const fileType = ALLOWED_TYPES[contentType];
  if (!fileType) {
    return NextResponse.json({ error: "Tipo não permitido." }, { status: 400 });
  }

  const ext = fileName.split(".").pop();
  const path = `${uuidv4()}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Signed URL error:", error);
    return NextResponse.json({ error: "Erro ao gerar URL de upload." }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path,
    publicUrl: urlData.publicUrl,
    fileType,
  });
}
