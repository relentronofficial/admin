"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Fullscreen viewer for a set of image/video URLs. Detects video vs
 * image by file extension; anything unknown is rendered as an image.
 */
export function MediaViewer({
  urls,
  initialIndex = 0,
  onClose,
}: {
  urls: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const clamped = Math.max(0, Math.min(urls.length - 1, initialIndex));
  const [index, setIndex] = useState(clamped);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(urls.length - 1, i + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [urls.length, onClose]);

  if (urls.length === 0) return null;
  const current = urls[index];
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(current);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
        aria-label="Close"
      >
        <X size={22} />
      </button>

      {urls.length > 1 && index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => Math.max(0, i - 1));
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
          aria-label="Previous"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      {urls.length > 1 && index < urls.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => Math.min(urls.length - 1, i + 1));
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
          aria-label="Next"
        >
          <ChevronRight size={26} />
        </button>
      )}

      <div
        className="max-w-[95vw] max-h-[95vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            key={current}
            src={current}
            controls
            autoPlay
            className="max-w-[95vw] max-h-[95vh]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current}
            src={current}
            alt=""
            className="max-w-[95vw] max-h-[95vh] object-contain"
          />
        )}
      </div>

      {urls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-xs bg-black/60 px-3 py-1 rounded-full">
          {index + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}
