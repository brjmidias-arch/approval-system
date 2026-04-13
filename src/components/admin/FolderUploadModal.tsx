"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

type ContentType = "CARROSSEL" | "POST_FEED" | "REELS" | "STORIES";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
};

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  CARROSSEL: "text-purple-400 bg-purple-900/20",
  POST_FEED: "text-blue-400 bg-blue-900/20",
  REELS: "text-pink-400 bg-pink-900/20",
  STORIES: "text-amber-400 bg-amber-900/20",
};

interface ParsedPost {
  tempId: string;
  folderName: string;
  contentType: ContentType;
  mainFiles: File[];
  coverFile: File | null;
  caption: string;
  driveUrl: string;
  coverDriveUrl: string;
  title: string;
  scheduledDate: string;
}

function inferContentType(name: string, files: File[]): ContentType {
  const n = name.toLowerCase();
  if (n.includes("carrossel") || n.includes("carousel")) return "CARROSSEL";
  if (n.includes("reels") || n.includes("reel")) return "REELS";
  if (n.includes("stories") || n.includes("story")) return "STORIES";
  if (n.includes("feed")) return "POST_FEED";
  const hasVideo = files.some((f) => f.type.startsWith("video/"));
  if (hasVideo) return "REELS";
  if (files.length > 1) return "CARROSSEL";
  return "POST_FEED";
}

function parseFolder(fileList: FileList): ParsedPost[] {
  const files = Array.from(fileList).filter((f) => !f.name.startsWith("."));
  const groups = new Map<string, { key: string; name: string; files: File[] }>();

  for (const file of files) {
    const segments = file.webkitRelativePath.split("/");
    // segments[0] = root folder name (ignored)
    let key: string;
    let name: string;
    if (segments.length === 2) {
      // File directly in root → each file = its own post
      const baseName = segments[1].replace(/\.[^.]+$/, "");
      key = `__root__${segments[1]}`;
      name = baseName;
    } else {
      // File in subfolder → group by subfolder
      key = `__sub__${segments[1]}`;
      name = segments[1];
    }
    if (!groups.has(key)) groups.set(key, { key, name, files: [] });
    groups.get(key)!.files.push(file);
  }

  // Sort groups by subfolder name naturally
  const sorted = Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  return sorted.map(({ name, files: gFiles }) => {
    const sortedFiles = [...gFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    const contentType = inferContentType(name, sortedFiles);

    let mainFiles: File[];
    let coverFile: File | null = null;

    if (contentType === "REELS") {
      const videos = sortedFiles.filter((f) => f.type.startsWith("video/"));
      const images = sortedFiles.filter((f) => f.type.startsWith("image/"));
      mainFiles = videos.length > 0 ? videos : sortedFiles;
      coverFile = images.length > 0 ? images[0] : null;
    } else {
      mainFiles = sortedFiles;
    }

    return {
      tempId: uuidv4(),
      folderName: name,
      contentType,
      mainFiles,
      coverFile,
      caption: "",
      driveUrl: "",
      coverDriveUrl: "",
      title: name,
      scheduledDate: "",
    };
  });
}

function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Status ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Falha na conexão"));
    xhr.send(file);
  });
}

async function uploadFile(file: File): Promise<{ publicUrl: string; fileType: string } | null> {
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, fileName: file.name }),
  });
  if (!res.ok) return null;
  const { signedUrl, publicUrl, fileType } = await res.json();
  await uploadWithProgress(signedUrl, file, () => {});
  return { publicUrl, fileType };
}

interface Props {
  campaignId: string;
  existingItemCount: number;
  onDone: () => void;
  onClose: () => void;
}

type Step = "select" | "review" | "uploading" | "done";

export default function FolderUploadModal({ campaignId, existingItemCount, onDone, onClose }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [posts, setPosts] = useState<ParsedPost[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [uploadedCount, setUploadedCount] = useState(0);
  const [lightboxFile, setLightboxFile] = useState<File | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function openLightbox(file: File) {
    setLightboxFile(file);
    setLightboxUrl(URL.createObjectURL(file));
  }

  function closeLightbox() {
    if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);
    setLightboxFile(null);
    setLightboxUrl(null);
  }

  useEffect(() => {
    if (!lightboxUrl) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxUrl]);

  function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const parsed = parseFolder(files);
    if (parsed.length === 0) return;
    setPosts(parsed);
    setStep("review");
  }

  function updatePost(tempId: string, field: keyof ParsedPost, value: string | ContentType) {
    setPosts((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, [field]: value } : p))
    );
  }

  function removePost(tempId: string) {
    setPosts((prev) => prev.filter((p) => p.tempId !== tempId));
  }

  async function handleUpload() {
    setStep("uploading");
    setProgress({ current: 0, total: posts.length, label: "" });
    let baseOrder = existingItemCount + 1;

    for (let pi = 0; pi < posts.length; pi++) {
      const post = posts[pi];
      setProgress({ current: pi + 1, total: posts.length, label: `${post.title || post.folderName}` });

      const groupId = post.contentType === "CARROSSEL" ? uuidv4() : null;

      // Upload cover if REELS
      let coverUrl: string | null = null;
      if (post.contentType === "REELS" && post.coverFile) {
        const result = await uploadFile(post.coverFile);
        if (result) coverUrl = result.publicUrl;
      }

      // Upload main files
      for (let fi = 0; fi < post.mainFiles.length; fi++) {
        const file = post.mainFiles[fi];
        const result = await uploadFile(file);
        if (!result) continue;

        await fetch(`/api/admin/campaigns/${campaignId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: result.publicUrl,
            fileType: result.fileType,
            title: post.title || null,
            caption: post.caption || null,
            scheduledDate: post.scheduledDate || null,
            driveUrl: post.driveUrl || null,
            coverUrl: fi === 0 ? coverUrl : null,
            coverDriveUrl: fi === 0 ? (post.coverDriveUrl || null) : null,
            contentType: post.contentType,
            groupId,
            order: baseOrder++,
          }),
        });
      }
    }

    setUploadedCount(posts.length);
    setStep("done");
    onDone();
  }

  // Thumbnail preview for a file — clickable to open lightbox
  function FileThumbnail({ file, className }: { file: File; className?: string }) {
    const [url] = useState(() => URL.createObjectURL(file));
    const isImage = file.type.startsWith("image/");
    return isImage ? (
      <button
        type="button"
        onClick={() => openLightbox(file)}
        className="shrink-0 focus:outline-none group relative"
        title="Ver imagem"
      >
        <img src={url} alt="" className={`${className ?? "w-10 h-10"} object-cover rounded cursor-zoom-in group-hover:brightness-75 transition-all`} />
      </button>
    ) : (
      <div className={`flex items-center justify-center bg-black/40 rounded text-xl shrink-0 ${className ?? "w-10 h-10"}`}>
        🎬
      </div>
    );
  }

  return (
    <>
    {/* Lightbox */}
    {lightboxUrl && lightboxFile && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
        onClick={closeLightbox}
      >
        <button
          className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl leading-none"
          onClick={closeLightbox}
        >×</button>
        <img
          src={lightboxUrl}
          alt=""
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <p className="absolute bottom-4 text-gray-500 text-xs">{lightboxFile.name}</p>
      </div>
    )}

    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-semibold text-base">Upload de Pasta</h2>
            {step === "review" && (
              <p className="text-gray-500 text-xs mt-0.5">{posts.length} {posts.length === 1 ? "post" : "posts"} · clique na imagem para ampliar · × para remover</p>
            )}
          </div>
          {step !== "uploading" && (
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">×</button>
          )}
        </div>

        {/* SELECT STEP */}
        {step === "select" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">📁</div>
            <div>
              <p className="text-white font-medium">Selecione a pasta de conteúdos</p>
              <p className="text-gray-500 text-sm mt-1">
                Organize subpastas por tipo: <span className="text-gray-400">Carrossel 1/</span>, <span className="text-gray-400">Reels/</span>, <span className="text-gray-400">Stories/</span>...
              </p>
              <p className="text-gray-600 text-xs mt-2">Arquivos soltos na raiz viram posts individuais</p>
            </div>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Escolher pasta
            </button>
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              // @ts-expect-error webkitdirectory is not in the type definitions
              webkitdirectory=""
              multiple
              onChange={handleFolderChange}
            />
          </div>
        )}

        {/* REVIEW STEP */}
        {step === "review" && (
          <div className="flex flex-col">
            <div className="px-5 py-3 space-y-4 max-h-[65vh] overflow-y-auto">
              {posts.map((post) => (
                <div key={post.tempId} className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
                  {/* Post header */}
                  <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                    {/* Thumbnails */}
                    <div className="flex gap-1 shrink-0 flex-wrap max-w-[11rem]">
                      {post.mainFiles.slice(0, 6).map((f, i) => (
                        <FileThumbnail key={i} file={f} className="w-10 h-10 object-cover rounded" />
                      ))}
                      {post.mainFiles.length > 6 && (
                        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-xs text-gray-400">
                          +{post.mainFiles.length - 6}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={post.title}
                        onChange={(e) => updatePost(post.tempId, "title", e.target.value)}
                        placeholder="Título do post"
                        className="w-full bg-transparent text-white text-sm font-medium focus:outline-none placeholder-gray-600 truncate"
                      />
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <select
                          value={post.contentType}
                          onChange={(e) => updatePost(post.tempId, "contentType", e.target.value as ContentType)}
                          className={`text-xs font-medium px-2 py-0.5 rounded border-0 focus:outline-none cursor-pointer ${CONTENT_TYPE_COLORS[post.contentType]} bg-transparent`}
                        >
                          {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((t) => (
                            <option key={t} value={t} className="bg-[#1a1a1a] text-white">{CONTENT_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                        <span className="text-gray-600 text-xs">{post.mainFiles.length} {post.mainFiles.length === 1 ? "arquivo" : "arquivos"}</span>
                        {post.coverFile && <span className="text-xs text-gray-500">+ capa</span>}
                      </div>
                    </div>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removePost(post.tempId)}
                      className="shrink-0 text-gray-600 hover:text-red-400 transition-colors text-lg leading-none mt-0.5"
                      title="Remover este post"
                    >
                      ×
                    </button>
                  </div>

                  {/* Fields */}
                  <div className="px-4 pb-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-gray-500 text-xs shrink-0">Data prevista:</label>
                      <input
                        type="date"
                        value={post.scheduledDate}
                        onChange={(e) => updatePost(post.tempId, "scheduledDate", e.target.value)}
                        className="bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600 [color-scheme:dark]"
                      />
                    </div>
                    <textarea
                      value={post.caption}
                      onChange={(e) => updatePost(post.tempId, "caption", e.target.value)}
                      placeholder="Legenda (opcional)"
                      rows={2}
                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none placeholder-gray-600"
                    />
                    <input
                      type="url"
                      value={post.driveUrl}
                      onChange={(e) => updatePost(post.tempId, "driveUrl", e.target.value)}
                      placeholder="Link do Drive (opcional)"
                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                    />
                    {post.contentType === "REELS" && (
                      <input
                        type="url"
                        value={post.coverDriveUrl}
                        onChange={(e) => updatePost(post.tempId, "coverDriveUrl", e.target.value)}
                        placeholder="Link da capa no Drive (opcional)"
                        className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => { setStep("select"); setPosts([]); }}
                className="flex-1 py-2.5 rounded-lg text-sm bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleUpload}
                disabled={posts.length === 0}
                className="flex-1 py-2.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                Fazer upload ({posts.length} {posts.length === 1 ? "post" : "posts"})
              </button>
            </div>
          </div>
        )}

        {/* UPLOADING STEP */}
        {step === "uploading" && (
          <div className="p-8 flex flex-col items-center gap-6 text-center">
            <div className="text-4xl animate-bounce">⬆️</div>
            <div>
              <p className="text-white font-medium">Enviando posts...</p>
              <p className="text-gray-400 text-sm mt-1">{progress.label}</p>
              <p className="text-gray-600 text-xs mt-0.5">{progress.current} de {progress.total}</p>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* DONE STEP */}
        {step === "done" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">✅</div>
            <div>
              <p className="text-white font-medium">{uploadedCount} {uploadedCount === 1 ? "post enviado" : "posts enviados"} com sucesso!</p>
              <p className="text-gray-500 text-sm mt-1">Os posts já aparecem na campanha.</p>
            </div>
            <button
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
