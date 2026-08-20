"use client";

import { useMemo, useState } from "react";
import { Check, Forward, Loader2, Users, X } from "lucide-react";
import { useMyChatGroups } from "@/lib/hooks/useChatGroups";

interface ForwardPickerSheetProps {
  /**
   * The group this message came from — hidden from the picker (you
   * can't forward a message back to its origin group).
   */
  fromGroupId: string;
  /**
   * Preview of the message being forwarded — shown at the top of the
   * sheet so users see what they're about to share.
   */
  previewText?: string | null;
  previewMediaType?: string | null;
  onClose: () => void;
  onSubmit: (toGroupIds: string[]) => Promise<void> | void;
}

/**
 * Modal sheet listing all groups the user belongs to with checkbox
 * multi-select. Emits the selected IDs to `onSubmit` which is expected
 * to call the forward endpoint.
 */
export function ForwardPickerSheet({
  fromGroupId,
  previewText,
  previewMediaType,
  onClose,
  onSubmit,
}: ForwardPickerSheetProps) {
  const { data: groups = [], isLoading } = useMyChatGroups();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  const eligible = useMemo(
    () => groups.filter((g) => g.id !== fromGroupId),
    [groups, fromGroupId],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((g) => g.name.toLowerCase().includes(q));
  }, [eligible, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(Array.from(selected));
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <Forward size={16} className="text-foreground" />
            <h3 className="text-base font-bold text-foreground">Forward to…</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {(previewText || previewMediaType) && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded-lg text-[11px]"
            style={{
              background: "var(--color-bg-surface)",
              borderLeft: "3px solid var(--color-accent)",
            }}
          >
            <div className="font-bold" style={{ color: "var(--color-accent)" }}>
              Message
            </div>
            <div className="text-muted-foreground truncate">
              {previewText || (previewMediaType ? `📎 ${previewMediaType}` : "…")}
            </div>
          </div>
        )}

        <div className="p-4 flex-shrink-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups…"
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground outline-none"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 size={14} className="animate-spin mr-2" /> Loading groups…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {query.trim() ? "No groups match." : "No other groups to forward to."}
            </div>
          ) : (
            filtered.map((g) => {
              const isSelected = selected.has(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggle(g.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-[var(--color-surface-overlay)] transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: "var(--color-surface-overlay)" }}
                  >
                    {g.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{g.name}</div>
                  </div>
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isSelected ? "var(--color-accent)" : "transparent",
                      border: `1.5px solid ${isSelected ? "var(--color-accent)" : "var(--color-border-medium)"}`,
                    }}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div
          className="p-4 flex-shrink-0"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--color-accent)" }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Forward{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
