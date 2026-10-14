"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import toast from "react-hot-toast";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useMentorshipModules, useUpdateMentorshipModules } from "@/lib/hooks/useMentorship";
import type { MentorshipModuleOption } from "@/lib/api/services/mentorship.service";

const OVERLAY = "var(--color-surface-overlay, rgba(255,255,255,0.05))";
const BORDER = "var(--color-border-subtle, rgba(255,255,255,0.08))";

/** Multi-select cards for the admin-configured mentorship modules. Presentational only. */
export function MentorshipModuleOptions({
  options,
  value,
  onChange,
  disabled,
}: {
  options: MentorshipModuleOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (name: string) => {
    const next = value.includes(name) ? value.filter((v) => v !== name) : [...value, name];
    // Keep the configured module order regardless of click order.
    onChange(options.map((o) => o.moduleName).filter((n) => next.includes(n)));
  };

  return (
    <div role="group" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((o) => {
        const selected = value.includes(o.moduleName);
        const accent = o.accentColor || "var(--color-accent)";
        return (
          <button
            key={o.moduleName}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(o.moduleName)}
            className="text-left rounded-xl px-4 py-3.5 flex items-start gap-3 transition-all disabled:opacity-50"
            style={{
              background: selected ? `color-mix(in srgb, ${accent} 12%, transparent)` : OVERLAY,
              border: `1px solid ${selected ? accent : BORDER}`,
            }}
          >
            <span
              className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0"
              style={{ background: selected ? accent : "transparent", border: `1px solid ${selected ? accent : BORDER}` }}
            >
              {selected && <Check size={13} color="#ffffff" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{o.displayName || o.moduleName}</span>
              {o.tagline && (
                <span className="block text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                  {o.tagline}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Loads the member's saved selection from the server, lets them edit it and
 * saves it back. Used on /courses for members who have not chosen yet or want
 * to change their modules.
 */
export function MentorshipModuleSelector({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const { uiStrings } = useSiteConfig();
  const { data, isLoading, isError, refetch } = useMentorshipModules();
  const update = useUpdateMentorshipModules();
  const [value, setValue] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    const available = new Set(data.options.map((o) => o.moduleName));
    setValue((data.selection ?? []).filter((m) => available.has(m)));
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: OVERLAY }} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        <span>{uiStrings?.mentorshipModulesLoadError ?? "We couldn't load your mentorship modules."}</span>
        <button type="button" onClick={() => refetch()} className="font-semibold" style={{ color: "var(--color-accent)" }}>
          {uiStrings?.mentorshipModulesRetry ?? "Retry"}
        </button>
      </div>
    );
  }

  if (data.options.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {uiStrings?.mentorshipModulesNoneAvailable ?? "No mentorship modules are available right now."}
      </p>
    );
  }

  const save = () =>
    update.mutate(value, {
      onSuccess: () => {
        toast.success(uiStrings?.mentorshipModulesSaved ?? "Mentorship modules updated");
        onDone?.();
      },
      onError: (e) => toast.error((e as Error).message),
    });

  return (
    <div>
      <MentorshipModuleOptions options={data.options} value={value} onChange={setValue} disabled={update.isPending} />
      <div className="flex justify-end gap-3 mt-5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {uiStrings?.mentorshipModulesCancel ?? "Cancel"}
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={value.length === 0 || update.isPending}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-accent)" }}
        >
          {uiStrings?.mentorshipModulesSave ?? "Save selection"}
        </button>
      </div>
    </div>
  );
}
