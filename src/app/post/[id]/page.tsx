"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Slide {
  id: string;
  fileUrl: string;
  fileType: string;
  order: number;
}

interface PostData {
  campaignName: string;
  clientName: string;
  title: string | null;
  caption: string | null;
  scheduledDate: string | null;
  contentType: string;
  driveUrl: string | null;
  slides: Slide[];
  clientComment: string | null;
  clientCommentResolved: boolean;
  internalComment: string | null;
  internalCommentResolved: boolean;
  history: HistoryItem[];
}

interface HistoryItem {
  source: "CLIENTE" | "INTERNO";
  status: "ADJUSTMENT" | "REJECTED";
  comment: string | null;
  createdAt: string;
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/post/${id}`, { cache: "no-store" });
      if (!res.ok) { setNotFound(true); return; }
      setData(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0f0f0f] text-gray-400 p-8">Carregando...</div>;
  if (notFound || !data) return <div className="min-h-screen bg-[#0f0f0f] text-red-400 p-8">Post não encontrado.</div>;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* Cabeçalho */}
        <div>
          <p className="text-sm text-gray-400">
            {data.clientName} <span className="text-gray-600">·</span> {data.campaignName}
          </p>
          {data.title && <h1 className="text-xl font-semibold mt-0.5">{data.title}</h1>}
          {data.scheduledDate && (
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(data.scheduledDate).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {/* Galeria */}
        <div className="flex gap-2 flex-wrap">
          {data.slides.map((slide, i) => (
            <div key={slide.id} className="w-28 h-28 rounded-lg overflow-hidden bg-black/40 relative shrink-0">
              {slide.fileType === "IMAGE" ? (
                <img
                  src={slide.fileUrl}
                  alt=""
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxUrl(slide.fileUrl)}
                />
              ) : slide.fileType === "VIDEO" ? (
                <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
              ) : slide.fileType === "DOCUMENT" ? (
                <a
                  href={slide.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-full flex items-center justify-center text-2xl hover:bg-white/5 transition-colors"
                  title="Abrir documento"
                >
                  📝
                </a>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">📄</div>
              )}
              <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Legenda */}
        {data.caption && <p className="text-sm text-gray-300 whitespace-pre-line">{data.caption}</p>}

        {/* Link do Drive */}
        {data.driveUrl && (
          <a
            href={data.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-2 rounded-lg transition-colors"
          >
            🔗 Abrir no Drive
          </a>
        )}

        {/* Ajuste do cliente */}
        {data.clientComment && (
          <div className="text-sm rounded-lg px-3 py-2.5 text-amber-400 bg-amber-900/20 border border-amber-500/20">
            <span className="opacity-70">Ajuste do cliente: </span>
            <span className={data.clientCommentResolved ? "line-through opacity-60" : ""}>{data.clientComment}</span>
            {data.clientCommentResolved && <span className="ml-1.5">✅</span>}
          </div>
        )}

        {/* Revisão interna */}
        {data.internalComment && (
          <div className="text-sm rounded-lg px-3 py-2.5 text-violet-300 bg-violet-900/20 border border-violet-500/20">
            <span className="opacity-70">Revisão interna: </span>
            <span className={data.internalCommentResolved ? "line-through opacity-60" : ""}>{data.internalComment}</span>
            {data.internalCommentResolved && <span className="ml-1.5">✅</span>}
          </div>
        )}

        {/* Histórico de ajustes (todos os pedidos, do mais recente ao mais antigo) */}
        {data.history.length > 0 && (
          <div className="border-t border-white/10 pt-4 space-y-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Histórico de ajustes</p>
            {data.history.map((h, i) => {
              const isClient = h.source === "CLIENTE";
              const label = h.status === "REJECTED" ? "Reprovou" : "Pediu ajuste";
              const who = isClient ? "Cliente" : "Revisão interna";
              return (
                <div
                  key={i}
                  className={`text-sm rounded-lg px-3 py-2.5 border ${
                    isClient
                      ? "text-amber-400 bg-amber-900/10 border-amber-500/15"
                      : "text-violet-300 bg-violet-900/10 border-violet-500/15"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs opacity-70">{who} · {label}</span>
                    <span className="text-xs opacity-50">{new Date(h.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {h.comment && <p className="mt-1 whitespace-pre-line">{h.comment}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightboxUrl(null)} className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm">
              ✕ Fechar (Esc)
            </button>
            <img src={lightboxUrl} alt="" className="w-full rounded-xl object-contain max-h-[85vh]" />
          </div>
        </div>
      )}
    </div>
  );
}
