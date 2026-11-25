"use client";

import { useId, type CSSProperties } from "react";
import type { WeeklyAnswer, WeeklyQuestion } from "@/lib/api/services/courseReports.service";

const BOX = "w-full rounded-lg px-3 text-sm outline-none border text-foreground bg-transparent disabled:opacity-50";

/** One admin-written weekly report question, drawn for its answer type. */
export function QuestionField({ q, value, onChange, disabled, style }: {
  q: WeeklyQuestion;
  value: WeeklyAnswer | undefined;
  onChange: (v: WeeklyAnswer) => void;
  disabled: boolean;
  style: CSSProperties;
}) {
  const id = useId();
  const text = value === undefined || Array.isArray(value) ? "" : String(value);
  const picked = Array.isArray(value) ? value : [];
  const helpId = q.help ? `${id}-help` : undefined;
  const common = { id, disabled, style, "aria-describedby": helpId, "aria-required": q.required };

  const label = (
    <>
      {q.question} {q.required ? <span style={{ color: "var(--color-accent)" }}>*</span> : <span className="font-normal">(optional)</span>}
    </>
  );
  const labelClass = "block text-xs font-semibold text-muted-foreground mb-1.5 break-words";
  const help = q.help && <p id={helpId} className="text-xs text-muted-foreground mb-1.5 break-words">{q.help}</p>;

  const choices =
    q.type === "yes_no" ? ["Yes", "No"]
      : q.type === "rating" ? Array.from({ length: 10 }, (_, i) => String(i + 1))
        : q.type === "single_choice" || q.type === "multi_choice" ? q.options
          : null;

  if (choices) {
    const multi = q.type === "multi_choice";
    const inline = q.type === "yes_no" || q.type === "rating";
    return (
      <fieldset disabled={disabled} aria-describedby={helpId}>
        <legend className={labelClass}>{label}</legend>
        {help}
        <div className={q.type === "rating" ? "grid grid-cols-5 gap-2" : inline ? "grid grid-cols-2 gap-2" : "space-y-2"}>
          {choices.map((c) => {
            const on = multi ? picked.includes(c) : text === c;
            return (
              <label
                key={c}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-foreground cursor-pointer focus-within:ring-2 ${inline ? "justify-center" : ""} ${disabled ? "opacity-50" : ""}`}
                style={{ ...style, ...(on ? { borderColor: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" } : {}) }}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={id}
                  checked={on}
                  onChange={() => onChange(multi ? (on ? picked.filter((p) => p !== c) : [...picked, c]) : c)}
                  className={inline ? "sr-only" : "shrink-0"}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span className="min-w-0 break-words">{c}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {help}
      {q.type === "long_text" ? (
        <textarea {...common} value={text} rows={4} maxLength={2000} onChange={(e) => onChange(e.target.value)} className={`${BOX} py-2.5 resize-none`} />
      ) : (
        <input
          {...common}
          value={text}
          type={q.type === "number" ? "number" : q.type === "date" ? "date" : "text"}
          step={q.type === "number" ? "any" : undefined}
          maxLength={q.type === "short_text" ? 300 : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${BOX} h-10`}
        />
      )}
    </div>
  );
}
