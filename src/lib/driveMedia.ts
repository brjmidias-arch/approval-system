import { prisma } from "@/lib/prisma";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];

type DriveFile = { id: string; name: string; mimeType: string };

function extractDriveId(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /\/folders\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const thumb = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
const preview = (id: string) => `https://drive.google.com/file/d/${id}/preview`;

async function listFolderFiles(folderId: string, apiKey: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType)");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&key=${apiKey}&fields=${fields}&pageSize=100`
  );
  const data = await res.json();
  if (data.error) return [];
  const files: DriveFile[] = (data.files || []).filter((f: DriveFile) => ALLOWED.includes(f.mimeType));
  return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

/**
 * Re-busca a mídia do Drive e atualiza os previews (fileUrl/fileType) dos itens.
 * Best-effort: em erro/ausência de chave, não faz nada.
 * - sourceDriveUrl com /folders/ → atualiza todos os slides na ordem (carrossel).
 * - link de arquivo e 1 item → atualiza o post único.
 * Aplica cache-buster (&v) para forçar o navegador a baixar a arte nova.
 */
export async function refreshGroupMediaFromDrive(
  sourceDriveUrl: string | null,
  items: { id: string; fileType: string }[]
): Promise<void> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey || !sourceDriveUrl) return;
  const bust = Date.now();
  const bt = (u: string) => (u.includes("thumbnail?") ? `${u}&v=${bust}` : u);
  try {
    if (sourceDriveUrl.includes("/folders/")) {
      const folderId = extractDriveId(sourceDriveUrl);
      if (!folderId) return;
      const files = await listFolderFiles(folderId, apiKey);
      if (!files.length) return;
      const n = Math.min(files.length, items.length);
      for (let i = 0; i < n; i++) {
        const f = files[i];
        const isVid = f.mimeType.startsWith("video/");
        await prisma.contentItem.update({
          where: { id: items[i].id },
          data: {
            fileUrl: bt(isVid ? preview(f.id) : thumb(f.id)),
            fileType: isVid ? "VIDEO" : "IMAGE",
            driveUrl: sourceDriveUrl,
          },
        });
      }
    } else if (items.length === 1) {
      const id = extractDriveId(sourceDriveUrl);
      if (!id) return;
      const isVid = items[0].fileType === "VIDEO";
      await prisma.contentItem.update({
        where: { id: items[0].id },
        data: { fileUrl: bt(isVid ? preview(id) : thumb(id)) },
      });
    }
  } catch {
    // best-effort
  }
}
