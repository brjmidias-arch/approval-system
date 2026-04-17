import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];
const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveItem = { id: string; name: string; mimeType: string };

function naturalSort(items: DriveItem[]): DriveItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

async function listFolder(folderId: string, apiKey: string) {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType)");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&key=${apiKey}&fields=${fields}&pageSize=100`
  );
  return res.json();
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { folderId } = await req.json();
  if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Drive API not configured" }, { status: 500 });

  const data = await listFolder(folderId, apiKey);
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

  const allItems: DriveItem[] = data.files || [];
  const subfolders = naturalSort(allItems.filter((f) => f.mimeType === FOLDER_MIME));
  const directFiles = naturalSort(allItems.filter((f) => ALLOWED.includes(f.mimeType)));

  // Se tem subpastas → cada subpasta = um carrossel
  if (subfolders.length > 0) {
    const groups: { folderName: string; folderId: string; files: DriveItem[] }[] = [];

    for (const sub of subfolders) {
      const subData = await listFolder(sub.id, apiKey);
      if (subData.error) continue;
      const subFiles = naturalSort((subData.files || []).filter((f: DriveItem) => ALLOWED.includes(f.mimeType)));
      if (subFiles.length > 0) {
        groups.push({ folderName: sub.name, folderId: sub.id, files: subFiles });
      }
    }

    return NextResponse.json({ groups, looseFiles: directFiles });
  }

  // Sem subpastas → todos os arquivos = um carrossel
  return NextResponse.json({ files: directFiles });
}
