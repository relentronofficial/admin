"use client";

import React from "react";
import { Download, FileText } from "lucide-react";
import type { EpisodeResource } from "@/lib/api/services/courses.service";

export type ResourceKind = "image" | "video" | "audio" | "file";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|flac)(\?|#|$)/i;

/**
 * Admin-set `fileType` wins; the URL extension is the fallback for resources
 * saved with the form's default type ("pdf") even though the upload was media.
 */
export function getResourceKind(r: Pick<EpisodeResource, "fileType" | "fileUrl">): ResourceKind {
  const type = (r.fileType ?? "").toLowerCase();
  const url = r.fileUrl ?? "";
  if (type === "image" || type.startsWith("image/") || IMAGE_EXT.test(url)) return "image";
  if (type === "video" || type.startsWith("video/") || VIDEO_EXT.test(url)) return "video";
  if (type === "audio" || type.startsWith("audio/") || AUDIO_EXT.test(url)) return "audio";
  return "file";
}

interface Props {
  resources: EpisodeResource[];
  heading: string;
  defaultDownloadLabel: string;
}

export function EpisodeResourcesSection({ resources, heading, defaultDownloadLabel }: Props) {
  const items = resources.filter((r) => !!r.fileUrl);
  if (items.length === 0) return null;

  return (
    <div
      data-testid="episode-resources"
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border-card)" }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--color-bg-surface)" }}>
        <Download size={14} style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
          {heading} ({items.length})
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--color-border-card)" }}>
        {items.map((r) => {
          const kind = getResourceKind(r);
          const url = r.fileUrl!;
          return (
            <div key={r.id} data-testid="episode-resource" data-kind={kind} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <FileText size={16} style={{ color: "var(--color-text-subtle)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-normal)" }}>{r.title}</p>
                  {r.description && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-subtle)" }}>{r.description}</p>
                  )}
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80 text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  <Download size={11} /> {r.downloadLabel || defaultDownloadLabel}
                </a>
              </div>

              {kind === "image" && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied R2/CDN hosts */}
                  <img
                    src={url}
                    alt={r.title}
                    loading="lazy"
                    className="w-full max-h-[480px] object-contain rounded-lg"
                    style={{ background: "var(--color-surface-overlay)" }}
                  />
                </a>
              )}
              {kind === "video" && (
                <video
                  src={url}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-[480px] rounded-lg bg-black"
                />
              )}
              {kind === "audio" && <audio src={url} controls preload="metadata" className="w-full" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
