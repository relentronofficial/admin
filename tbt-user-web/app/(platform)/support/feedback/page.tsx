"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Star } from "lucide-react";

import { useSubmitFeedback } from "@/lib/hooks/useSupport";

export default function FeedbackPage() {
  const router = useRouter();
  const submit = useSubmitFeedback();

  const [rating, setRating] = useState<number>(5);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!message.trim()) {
      setBanner("Please share your thoughts before submitting.");
      return;
    }
    setBusy(true);
    try {
      await submit.mutateAsync({
        message: message.trim(),
        rating,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      });
      setDone(true);
      setTimeout(() => router.push("/support"), 1600);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not submit feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(39,174,96,0.10)",
            border: "1px solid rgba(39,174,96,0.35)",
          }}
        >
          <CheckCircle2 size={30} style={{ color: "#27AE60" }} />
        </div>
        <h2 className="text-lg font-bold text-foreground">Thank you for your feedback!</h2>
        <p className="text-sm text-muted-foreground">Redirecting you back to Support…</p>
      </div>
    );
  }

  const displayRating = hover ?? rating;

  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/support"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Feedback</h1>
      </div>

      {banner && (
        <div
          className="mb-4 p-3 rounded-xl flex items-start gap-2 text-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#ef4444",
          }}
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <div className="text-sm font-semibold text-foreground text-center">
            How would you rate your experience?
          </div>
          <div
            className="flex items-center justify-center gap-1 mt-4"
            onMouseLeave={() => setHover(null)}
          >
            {[1, 2, 3, 4, 5].map((i) => {
              const active = i <= displayRating;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHover(i)}
                  className="p-1"
                  aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
                >
                  <Star
                    size={34}
                    fill={active ? "#f59e0b" : "none"}
                    color={active ? "#f59e0b" : "var(--color-text-subtle)"}
                    strokeWidth={1.5}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder="Tell us more"
          className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none resize-y"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        />

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wider flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: "var(--color-accent)" }}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> SUBMITTING…
            </>
          ) : (
            "SUBMIT"
          )}
        </button>
      </form>
    </div>
  );
}
