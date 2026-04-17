import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { folderId } = await req.json();
  if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Drive API not configured" }, { status: 500 });

  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType)");

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&key=${apiKey}&fields=${fields}&orderBy=name&pageSize=100`
  );
  const data = await res.json();

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];
  const files = (data.files || []).filter((f: { mimeType: string }) => allowed.includes(f.mimeType));

  return NextResponse.json({ files });
}
