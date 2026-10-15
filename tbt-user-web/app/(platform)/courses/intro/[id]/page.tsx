"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useOnboardingContent } from "@/lib/hooks/useOnboarding";

export default function IntroVideoPage() {
  const params = useParams();
  const router = useRouter();
  const stepId = params.id as string;

  const { data: contentSteps, isLoading } = useOnboardingContent();

  const step = useMemo(() => {
    const steps = (contentSteps as any[]) ?? [];
    return steps.find((s: any) => s.id === stepId) ?? null;
  }, [contentSteps, stepId]);

  const allVideoSteps = useMemo(
    () => ((contentSteps as any[]) ?? []).filter((s: any) => !!s.videoUrl),
    [contentSteps]
  );

  const currentIndex = allVideoSteps.findIndex((s: any) => s.id === stepId);

  return (
    <div className="min-h-screen pb-8" style={{ background: "var(--color-bg-primary)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderBottom: "1px solid #2a2a2e" }}
      >
        <button
          onClick={() => router.back()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "#1a1a1e",
            border: "1px solid #2a2a2e",
            cursor: "pointer",
            color: "#f5f5f7",
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92929b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Introduction
          </div>
          {step && (
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f5f5f7", marginTop: 1 }}>
              {step.title}
            </div>
          )}
        </div>
        {currentIndex >= 0 && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#92929b" }}>
            {currentIndex + 1} / {allVideoSteps.length}
          </div>
        )}
      </div>

      {/* Video */}
      <div className="px-4 pt-5">
        {isLoading && (
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: 14,
              background: "#1a1a1e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ color: "#92929b", fontSize: 13 }}>Loading…</div>
          </div>
        )}

        {!isLoading && step && (
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              margin: "0 auto",
              aspectRatio: "16/9",
              borderRadius: 14,
              overflow: "hidden",
              background: "#000",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            {step.videoUrl.endsWith(".m3u8") ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={step.videoUrl}
                controls
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <iframe
                src={step.videoUrl}
                allow="autoplay; fullscreen"
                allowFullScreen
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            )}
          </div>
        )}

        {!isLoading && !step && (
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: 14,
              background: "#1a1a1e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#92929b",
              fontSize: 14,
            }}
          >
            Video not found.
          </div>
        )}
      </div>

      {/* Description */}
      {step?.textBody && (
        <div className="px-4 mt-5" style={{ maxWidth: 900, margin: "20px auto 0" }}>
          <p style={{ fontSize: 14, color: "#a0a0a8", lineHeight: 1.6, padding: "0 16px" }}>
            {step.textBody}
          </p>
        </div>
      )}

      {/* Other videos in this module */}
      {allVideoSteps.length > 1 && (
        <div className="px-4 mt-8" style={{ maxWidth: 900, margin: "32px auto 0" }}>
          <div style={{ padding: "0 0px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#92929b", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px" }}>
              More in Introduction
            </h3>
            <div className="flex flex-col gap-3">
              {allVideoSteps.map((s: any, i: number) => {
                const isActive = s.id === stepId;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/courses/intro/${s.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: isActive ? "#242428" : "transparent",
                      border: `1px solid ${isActive ? "#414146" : "transparent"}`,
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {/* Mini thumbnail */}
                    <div
                      style={{
                        width: 80,
                        height: 50,
                        borderRadius: 7,
                        flexShrink: 0,
                        overflow: "hidden",
                        position: "relative",
                        background: "#0a0a0e",
                      }}
                    >
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.imageUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            background: "radial-gradient(ellipse at center, #10283b 0%, #071521 60%, #020508 100%)",
                          }}
                        />
                      )}
                      {isActive && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(220,38,38,0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="line-clamp-2"
                        style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#f5f5f7" : "#c0c0c8", lineHeight: 1.35 }}
                      >
                        {s.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#92929b", marginTop: 2 }}>
                        Video {i + 1}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
