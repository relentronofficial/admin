"use client";

// FAQ button for the Modules page heading row, plus the FAQ modal. Questions and
// answers come only from the admin-managed FAQ (GET /api/pub/module-faqs) —
// nothing is hardcoded here. Answers are plain text rendered as text.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, HelpCircle, X } from "lucide-react";
import { useModuleFaqs } from "@/lib/hooks/useModuleFaqs";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

// Same dark palette as the rest of the Modules page.
const SURFACE = "#1a1a1d";
const CARD = "#242428";
const BORDER = "#414146";
const TEXT = "#f5f5f7";
const MUTED = "#92929b";

function FaqModal({ onClose }: { onClose: () => void }) {
  const { uiStrings } = useSiteConfig();
  const s = uiStrings as any;
  const { data, isLoading, isError, refetch, isFetching } = useModuleFaqs(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const faqs = data ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modules-faq-title"
        className="w-full max-w-[100vw] sm:max-w-2xl max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: SURFACE, border: "1px solid #2a2a2e" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 id="modules-faq-title" className="inline-flex items-center gap-2" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>
            <HelpCircle size={18} style={{ color: "var(--color-accent)" }} />
            {s?.modulesFaqTitle ?? "Frequently Asked Questions"}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: CARD, color: MUTED }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading FAQs">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-[10px] animate-pulse" style={{ background: CARD }} />
              ))}
            </div>
          ) : isError ? (
            <div role="alert" className="rounded-[10px] p-5 text-center space-y-3" style={{ background: CARD }}>
              <p style={{ fontSize: 14, color: "#a0a0a8" }}>{s?.modulesFaqError ?? "We couldn't load the FAQs. Please try again."}</p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                style={{ padding: "8px 20px", borderRadius: 9, background: "var(--color-accent)", color: "white", fontSize: 13, fontWeight: 600, opacity: isFetching ? 0.6 : 1 }}
              >
                {isFetching ? s?.modulesFaqRetrying ?? "Retrying…" : s?.modulesFaqRetry ?? "Retry"}
              </button>
            </div>
          ) : faqs.length === 0 ? (
            <div className="rounded-[10px] p-6 text-center" style={{ background: CARD }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>{s?.modulesFaqEmptyTitle ?? "No FAQs yet"}</p>
              <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
                {s?.modulesFaqEmptyDesc ?? "The TBT team hasn't published any questions here yet. Please check back later, or reach out to Support."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {faqs.map((faq) => {
                const open = openIds.has(faq.id);
                const panelId = `faq-answer-${faq.id}`;
                return (
                  <li key={faq.id} className="rounded-[10px] overflow-hidden" style={{ background: CARD, border: `1px solid ${open ? BORDER : "transparent"}` }}>
                    <button
                      type="button"
                      onClick={() => toggle(faq.id)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      className="w-full flex items-center justify-between gap-3 text-left px-4 py-3"
                      style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}
                    >
                      <span className="min-w-0 break-words">{faq.question}</span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 transition-transform"
                        style={{ color: MUTED, transform: open ? "rotate(180deg)" : undefined }}
                      />
                    </button>
                    {open && (
                      <div
                        id={panelId}
                        role="region"
                        aria-label={faq.question}
                        className="px-4 pb-4 space-y-3"
                      >
                        {faq.answer && (
                          <p className="whitespace-pre-line break-words m-0" style={{ fontSize: 13, lineHeight: 1.65, color: "#c8c8ce" }}>
                            {faq.answer}
                          </p>
                        )}
                        {faq.videoUrl && (
                          <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
                            <iframe
                              src={faq.videoUrl}
                              title={faq.question}
                              allow="autoplay; fullscreen"
                              allowFullScreen
                              loading="lazy"
                              className="absolute inset-0 w-full h-full border-0"
                              style={{ borderRadius: 8 }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Right-aligned FAQ button for a Modules heading row; opens the FAQ modal. */
export default function ModulesFaqButton() {
  const { uiStrings } = useSiteConfig();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 shrink-0 transition-colors hover:brightness-125"
        style={{
          padding: "8px 16px",
          borderRadius: 9,
          fontSize: 13,
          fontWeight: 600,
          background: CARD,
          color: TEXT,
          border: `1px solid ${BORDER}`,
          cursor: "pointer",
        }}
      >
        <HelpCircle size={15} aria-hidden="true" />
        {(uiStrings as any)?.modulesFaqButton ?? "FAQ"}
      </button>
      {open && <FaqModal onClose={() => setOpen(false)} />}
    </>
  );
}
