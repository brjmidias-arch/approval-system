"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Miniatura do post que, ao ser clicada, abre uma prévia (lightbox) com a
 * imagem ou o vídeo em tamanho grande. Usada no Kanban e na Lista.
 */
export default function PostThumbnail({
  fileType,
  fileUrl,
  driveUrl,
  label,
}: {
  fileType: string;
  fileUrl: string;
  driveUrl?: string | null;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  function openPreview(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }
  function close(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        aria-label="Ver prévia do post"
        className="w-8 h-8 rounded-md overflow-hidden bg-black/40 shrink-0 flex items-center justify-center hover:ring-2 hover:ring-white/40 transition-all"
      >
        {fileType === "IMAGE" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : fileType === "VIDEO" ? (
          <span className="text-sm">🎬</span>
        ) : (
          <span className="text-sm">📄</span>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" onClick={close}>
            <div
              className="relative max-w-3xl w-full max-h-[88vh] flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={close}
                aria-label="Fechar prévia"
                className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-[#1a1a1a] border border-white/20 text-gray-300 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>

              {fileType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl} alt={label} className="max-w-full max-h-[80vh] rounded-lg object-contain" />
              ) : fileType === "VIDEO" ? (
                <video src={fileUrl} controls className="max-w-full max-h-[80vh] rounded-lg bg-black" />
              ) : (
                <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-10 text-center">
                  <p className="text-5xl mb-3">📄</p>
                  <p className="text-gray-300 text-sm">Prévia não disponível para este tipo de arquivo.</p>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap justify-center">
                <p className="text-white text-sm font-medium">{label}</p>
                {driveUrl && (
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-400 hover:text-emerald-300 text-xs"
                  >
                    Abrir no Google Drive ↗
                  </a>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
