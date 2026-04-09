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

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  const fileType = ALLOWED_TYPES[file.type];
  if (!fileType) {
    return NextResponse.json(
      { error: "Tipo não permitido. Use JPG, PNG, WebP, MP4 ou PDF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 100MB." }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const filename = `${uuidv4()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return NextResponse.json({ error: "Erro ao salvar arquivo." }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

  return NextResponse.json({
    url: urlData.publicUrl,
    fileType,
    originalName: file.name,
  });
}
