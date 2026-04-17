"use client";

import { useState } from "react";
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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface ParsedPost {
  tempId: string;
  title: string;
  contentType: ContentType;
  caption: string;
  scheduledDate: string;
  slides: DriveFile[];
  folderUrl: string | null;
  sourceUrl: string;
}

function extractDriveId(url: string): string | null {
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

function isFolder(url: string): boolean {
  return url.includes("/folders/");
}

function driveThumbUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

function driveFileViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function mimeToFileType(mimeType: string): string {
  if (mimeType.startsWith("video/")) return "VIDEO";
  return "IMAGE";
}

type Step = "input" | "loading" | "review" | "saving" | "done";

interface Props {
  campaignId: string;
  existingItemCount: number;
  onDone: () => void;
  onClose: () => void;
}

export default function FolderUploadModal({ campaignId, existingItemCount, onDone, onClose }: Props) {
  const [step, setStep] = useState<Step>("input");
  const [linksText, setLinksText] = useState("");
  const [posts, setPosts] = useState<ParsedPost[]>([]);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  async function handleContinue() {
    const lines = linksText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;

    setStep("loading");
    setError("");

    const parsed: ParsedPost[] = [];

    for (const line of lines) {
      const id = extractDriveId(line);
      if (!id) continue;

      if (isFolder(line)) {
        const res = await fetch("/api/drive/folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: id }),
        });
        const data = await res.json();
        if (data.error || !data.files?.length) {
          setError(`Não foi possível buscar arquivos da pasta. Verifique se está compartilhada publicamente.`);
          setStep("input");
          return;
        }
        parsed.push({
          tempId: uuidv4(),
          title: "",
          contentType: "CARROSSEL",
          caption: "",
          scheduledDate: "",
          slides: data.files,
          folderUrl: line,
          sourceUrl: line,
        });
      } else {
        parsed.push({
          tempId: uuidv4(),
          title: "",
          contentType: "POST_FEED",
          caption: "",
          scheduledDate: "",
          slides: [{ id, name: "post", mimeType: "image/jpeg" }],
          folderUrl: null,
          sourceUrl: line,
        });
      }
    }

    if (!parsed.length) {
      setError("Nenhum link válido encontrado. Use links do Google Drive.");
      setStep("input");
      return;
    }

    setPosts(parsed);
    setStep("review");
  }

  function updatePost(tempId: string, field: keyof ParsedPost, value: string | ContentType) {
    setPosts((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, [field]: value } : p)));
  }

  function removePost(tempId: string) {
    setPosts((prev) => prev.filter((p) => p.tempId !== tempId));
  }

  async function handleSave() {
    setStep("saving");
    let baseOrder = existingItemCount + 1;

    for (const post of posts) {
      const groupId = post.contentType === "CARROSSEL" ? uuidv4() : null;

      for (let i = 0; i < post.slides.length; i++) {
        const slide = post.slides[i];
        const fileUrl = driveThumbUrl(slide.id);
        const driveUrl = post.folderUrl && i === 0
          ? post.folderUrl
          : driveFileViewUrl(slide.id);

        await fetch(`/api/admin/campaigns/${campaignId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl,
            fileType: mimeToFileType(slide.mimeType),
            title: post.title || null,
            caption: post.caption || null,
            scheduledDate: post.scheduledDate || null,
            driveUrl,
            contentType: post.contentType,
            groupId,
            order: baseOrder++,
          }),
        });
      }
    }

    setSavedCount(posts.length);
    setStep("done");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-semibold text-base">
              {step === "input" && "Adicionar conteúdo via Drive"}
              {step === "loading" && "Buscando arquivos..."}
              {step === "review" && `Revisar posts`}
              {step === "saving" && "Salvando..."}
              {step === "done" && "Conteúdo adicionado!"}
            </h2>
            {step === "review" && (
              <p className="text-gray-500 text-xs mt-0.5">{posts.length} {posts.length === 1 ? "post" : "posts"} · × para remover</p>
            )}
          </div>
          {step !== "saving" && step !== "loading" && (
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
          )}
        </div>

        {/* INPUT */}
        {step === "input" && (
          <div className="p-6 space-y-4">
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg px-4 py-3 text-xs text-blue-300 space-y-1">
              <p><strong>📁 Link de pasta</strong> → vira carrossel (busca todos os arquivos da pasta)</p>
              <p><strong>🖼 Link de arquivo</strong> → vira post individual</p>
              <p className="text-blue-400/60">Vários links = vários posts/carrosseis</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Links do Google Drive (um por linha):</label>
              <textarea
                value={linksText}
                onChange={(e) => setLinksText(e.target.value)}
                rows={6}
                autoFocus
                placeholder={"https://drive.google.com/drive/folders/ABC123...\nhttps://drive.google.com/file/d/XYZ456..."}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none placeholder-gray-600"
              />
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
              <p className="text-gray-600 text-xs mt-2">Os arquivos precisam estar compartilhados como "Qualquer pessoa com o link"</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm bg-white/5 text-gray-400 hover:bg-white/10 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleContinue}
                disabled={!linksText.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* LOADING */}
        {step === "loading" && (
          <div className="p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Buscando arquivos no Drive...</p>
          </div>
        )}

        {/* REVIEW */}
        {step === "review" && (
          <div className="flex flex-col">
            <div className="px-5 py-3 space-y-4 max-h-[65vh] overflow-y-auto">
              {posts.map((post) => (
                <div key={post.tempId} className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
                  <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                    <div className="flex gap-1 shrink-0 flex-wrap max-w-[11rem]">
                      {post.slides.slice(0, 6).map((slide, i) => (
                        <img
                          key={i}
                          src={driveThumbUrl(slide.id)}
                          alt=""
                          className="w-10 h-10 object-cover rounded bg-black/40"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ))}
                      {post.slides.length > 6 && (
                        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-xs text-gray-400">
                          +{post.slides.length - 6}
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
                        <span className="text-gray-600 text-xs">{post.slides.length} {post.slides.length === 1 ? "arquivo" : "arquivos"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePost(post.tempId)}
                      className="shrink-0 text-gray-600 hover:text-red-400 transition-colors text-lg leading-none mt-0.5"
                    >×</button>
                  </div>
                  <div className="px-4 pb-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-gray-500 text-xs shrink-0">Data prevista:</label>
                      <input
                        type="date"
                        value={post.scheduledDate}
                        onChange={(e) => updatePost(post.tempId, "scheduledDate", e.target.value)}
                        className="bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                      />
                    </div>
                    <textarea
                      value={post.caption}
                      onChange={(e) => updatePost(post.tempId, "caption", e.target.value)}
                      placeholder="Legenda (opcional)"
                      rows={2}
                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none placeholder-gray-600"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => { setStep("input"); setPosts([]); }}
                className="flex-1 py-2.5 rounded-lg text-sm bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
              >Voltar</button>
              <button
                onClick={handleSave}
                disabled={posts.length === 0}
                className="flex-1 py-2.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium transition-colors"
              >
                Salvar ({posts.length} {posts.length === 1 ? "post" : "posts"})
              </button>
            </div>
          </div>
        )}

        {/* SAVING */}
        {step === "saving" && (
          <div className="p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Salvando posts...</p>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">✅</div>
            <div>
              <p className="text-white font-medium">{savedCount} {savedCount === 1 ? "post adicionado" : "posts adicionados"} com sucesso!</p>
              <p className="text-gray-500 text-sm mt-1">Os posts já aparecem na campanha.</p>
            </div>
            <button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
