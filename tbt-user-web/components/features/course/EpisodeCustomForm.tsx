"use client";

import { useState } from "react";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useSubmitEpisodeForm, useMyEpisodeFormSubmission } from "@/lib/hooks/useCourses";
import { CheckCircle2, Loader2 } from "lucide-react";

export type FormFieldType =
  | "text" | "email" | "number" | "textarea"
  | "dropdown" | "radio" | "checkbox" | "date" | "file";

export interface FormFieldConfig {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    errorMessage?: string;
  };
}

export interface EpisodeFormConfig {
  enabled: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
  allowMultiple?: boolean;
  fields: FormFieldConfig[];
}

interface Props {
  episodeId: string;
  config: EpisodeFormConfig;
}

function validateField(field: FormFieldConfig, value: unknown): string | null {
  const v = field.validation;
  const strVal = typeof value === "string" ? value : "";
  const numVal = typeof value === "number" ? value : parseFloat(strVal);

  if (field.required) {
    if (Array.isArray(value) && value.length === 0) return v?.errorMessage ?? `${field.label} is required`;
    if (!value && value !== 0) return v?.errorMessage ?? `${field.label} is required`;
    if (strVal.trim() === "" && field.type !== "number" && field.type !== "date") return v?.errorMessage ?? `${field.label} is required`;
  }
  if (!value && value !== 0) return null;

  if (v?.minLength && strVal.length < v.minLength)
    return v.errorMessage ?? `${field.label} must be at least ${v.minLength} characters`;
  if (v?.maxLength && strVal.length > v.maxLength)
    return v.errorMessage ?? `${field.label} must be at most ${v.maxLength} characters`;
  if (v?.min !== undefined && !isNaN(numVal) && numVal < v.min)
    return v.errorMessage ?? `${field.label} must be at least ${v.min}`;
  if (v?.max !== undefined && !isNaN(numVal) && numVal > v.max)
    return v.errorMessage ?? `${field.label} must be at most ${v.max}`;
  if (v?.pattern && strVal && !new RegExp(v.pattern).test(strVal))
    return v.errorMessage ?? `${field.label} is invalid`;
  if (field.type === "email" && strVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal))
    return "Enter a valid email address";
  return null;
}

export function EpisodeCustomForm({ episodeId, config }: Props) {
  const { uiStrings } = useSiteConfig();
  const { data: existingSubmission, isLoading: checkingExisting } = useMyEpisodeFormSubmission(episodeId);
  const submitForm = useSubmitEpisodeForm(episodeId);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!config?.enabled || config.fields.length === 0) return null;

  if (checkingExisting) return null;

  const alreadySubmitted = !config.allowMultiple && (existingSubmission || submitted);

  const setValue = (fieldId: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
    if (errors[fieldId]) setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    for (const field of config.fields) {
      const err = validateField(field, values[field.id]);
      if (err) newErrors[field.id] = err;
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    try {
      await submitForm.mutateAsync(values);
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Submission failed. Please try again.";
      setErrors({ _form: msg });
    }
  };

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
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
          {config.title || uiStrings?.episodeFormHeading || "Lesson Form"}
        </span>
      </div>

      <div className="p-4">
        {config.description && (
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            {config.description}
          </p>
        )}

        {alreadySubmitted ? (
          <div className="flex items-center gap-2 py-3">
            <CheckCircle2 size={18} style={{ color: "var(--color-success)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--color-success)" }}>
              {uiStrings?.episodeFormSubmittedMessage ?? "Your response has been submitted. Thank you!"}
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {config.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                error={errors[field.id]}
                onChange={(val) => setValue(field.id, val)}
              />
            ))}

            {errors._form && (
              <p className="text-sm" style={{ color: "var(--color-alert)" }}>{errors._form}</p>
            )}

            <button
              type="submit"
              disabled={submitForm.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {submitForm.isPending && <Loader2 size={14} className="animate-spin" />}
              {config.submitLabel || uiStrings?.episodeFormSubmitLabel || "Submit"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function FieldRenderer({
  field, value, error, onChange,
}: {
  field: FormFieldConfig;
  value: unknown;
  error?: string;
  onChange: (val: unknown) => void;
}) {
  const strVal = typeof value === "string" ? value : "";
  const inputClass = `w-full text-sm px-3 py-2 rounded-lg outline-none transition-all ${error ? "border-[var(--color-alert)]" : ""}`;
  const inputStyle: React.CSSProperties = {
    background: "var(--color-bg-surface)",
    border: `1px solid ${error ? "var(--color-alert)" : "var(--color-border-card)"}`,
    color: "var(--color-text-normal)",
  };

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
        {field.label}{field.required && <span style={{ color: "var(--color-accent)" }}> *</span>}
      </label>

      {(field.type === "text" || field.type === "email" || field.type === "number" || field.type === "date") && (
        <input
          type={field.type}
          value={strVal}
          placeholder={field.placeholder}
          className={inputClass}
          style={inputStyle}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          value={strVal}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputClass} resize-none`}
          style={inputStyle}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "dropdown" && (
        <select
          value={strVal}
          className={inputClass}
          style={inputStyle}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{field.placeholder || "Select an option"}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.type === "radio" && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={strVal === opt}
                onChange={() => onChange(opt)}
                style={{ accentColor: "var(--color-accent)" }}
              />
              <span className="text-sm" style={{ color: "var(--color-text-normal)" }}>{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === "checkbox" && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => {
            const checked = Array.isArray(value) ? (value as string[]).includes(opt) : false;
            return (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const prev = Array.isArray(value) ? (value as string[]) : [];
                    onChange(checked ? prev.filter((v) => v !== opt) : [...prev, opt]);
                  }}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-text-normal)" }}>{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === "file" && (
        <input
          type="file"
          className="w-full text-sm"
          style={{ color: "var(--color-text-secondary)" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file.name);
          }}
        />
      )}

      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--color-alert)" }}>{error}</p>
      )}
    </div>
  );
}
