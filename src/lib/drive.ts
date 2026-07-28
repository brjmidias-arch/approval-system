/** Helpers de link do Google Drive (compartilhados). */

export function extractDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function driveThumbUrl(id: string): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
}
export function drivePreviewUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/preview`;
}
export function driveFileViewUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`;
}

/**
 * A partir de um link do Drive (arquivo ou pasta) e do tipo do arquivo, devolve
 * os campos a salvar no post. Para link de arquivo, regenera também o preview
 * (fileUrl). Para pasta, atualiza só o link. Retorna null se o link for inválido.
 */
export function driveAssetsFromLink(
  url: string,
  fileType: string
): { driveUrl: string; fileUrl?: string } | null {
  const id = extractDriveId(url);
  if (!id) return null;
  if (url.includes("/folders/")) return { driveUrl: url };
  const fileUrl = fileType === "VIDEO" ? drivePreviewUrl(id) : driveThumbUrl(id);
  return { driveUrl: driveFileViewUrl(id), fileUrl };
}
