"use client";

import { useSiteConfig } from "@/lib/context/SiteConfigContext";

export interface SideContentButton {
  id: string;
  label: string;
  type: "external" | "internal";
  destination: string;
  variant?: "primary" | "secondary" | "outline";
}

export interface EpisodeSideContentConfig {
  enabled: boolean;
  text?: string;
  buttons?: SideContentButton[];
}

interface Props {
  config: EpisodeSideContentConfig;
}

export function EpisodeSideContent({ config }: Props) {
  const { uiStrings } = useSiteConfig();

  if (!config?.enabled) return null;
  const hasText = config.text && config.text.trim().length > 0;
  const buttons = config.buttons?.filter((b) => b.label) ?? [];
  if (!hasText && buttons.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border-card)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: "var(--color-bg-surface)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--color-accent)" }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
          {uiStrings?.episodeSideContentHeading ?? "About This Lesson"}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {hasText && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>
            {config.text}
          </p>
        )}

        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {buttons.map((btn) => {
              const hasDestination = !!btn.destination;
              const isExternal = btn.type === "external";
              const href = hasDestination
                ? (isExternal
                    ? btn.destination
                    : btn.destination.startsWith("/")
                    ? btn.destination
                    : `/${btn.destination}`)
                : undefined;
              const isPrimary = btn.variant === "primary" || !btn.variant;
              const btnStyle = isPrimary
                ? { background: "var(--color-accent)", color: "#fff" }
                : btn.variant === "outline"
                ? { border: "1px solid var(--color-accent)", color: "var(--color-accent)", background: "transparent" }
                : { background: "var(--color-bg-surface)", color: "var(--color-text-normal)", border: "1px solid var(--color-border-card)" };
              const className = "inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all";
              return hasDestination ? (
                <a
                  key={btn.id}
                  href={href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className={className}
                  style={btnStyle}
                >
                  {btn.label}
                  {isExternal && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  )}
                </a>
              ) : (
                <button key={btn.id} type="button" className={className} style={btnStyle}>
                  {btn.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
