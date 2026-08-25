"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0f0f0f", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                fontSize: 28,
              }}
            >
              ⚠️
            </div>

            <h1 style={{ color: "#f0f0f0", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ color: "#a0a0a0", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              A critical error occurred. Please refresh the page or try again later.
            </p>

            <button
              onClick={reset}
              style={{
                background: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
