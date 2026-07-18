"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Searchable combobox with an inline "add new" affordance.
 *
 * Behaviour:
 *   * Click / focus opens the dropdown.
 *   * User types → filters `options` by case-insensitive substring.
 *   * If no exact-case-insensitive match exists AND the input is
 *     non-empty, a "+ Add {input}" row appears at the bottom of the
 *     list. Selecting it calls `onCreate` (async — the parent hits
 *     the master API), then `onChange` with the new value.
 *   * Arrow keys navigate, Enter selects, Escape closes.
 *   * `onChange(value)` fires with the canonical string (from the
 *     option list) OR the just-created value (from onCreate's
 *     resolved return).
 *
 * Presentational only — the parent owns the option list, the
 * currently-selected value, and the create semantics. Zero coupling
 * to our API layer, so the component is drop-in reusable for any
 * master-dropdown context.
 */

export interface CreatableOption {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: CreatableOption[];
  onCreate?: (name: string) => Promise<CreatableOption>;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Show a small × button on the trigger to clear the selection. */
  clearable?: boolean;
}

export default function CreatableSelect({
  value,
  onChange,
  options,
  onCreate,
  isLoading = false,
  placeholder = "Search or type new…",
  disabled = false,
  clearable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter as the user types. Case-insensitive substring match, sorted
  // to keep exact-prefix matches at the top for a friendlier feel.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options
      .filter((o) => o.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp;
      });
  }, [options, query]);

  // Show the "+ Add" row when the input has content AND no filtered
  // option matches case-insensitively. `onCreate` is required — the
  // affordance stays hidden if the parent doesn't wire it.
  const showCreateRow = useMemo(() => {
    if (!onCreate) return false;
    const q = query.trim();
    if (!q) return false;
    return !filtered.some((o) => o.name.toLowerCase() === q.toLowerCase());
  }, [onCreate, filtered, query]);

  // Reset active-item index whenever the visible list changes so the
  // keyboard-navigation highlight stays on a valid row.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  // Click-outside closes the dropdown. Also collapses the search input
  // so the display shows the selected value rather than the last
  // stale search string.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commit = async (choice: CreatableOption | { create: string }) => {
    if ("create" in choice) {
      if (!onCreate || creating) return;
      setCreating(true);
      try {
        const created = await onCreate(choice.create);
        onChange(created.name);
        setOpen(false);
        setQuery("");
      } catch (err) {
        console.error("CreatableSelect: create failed", err);
      } finally {
        setCreating(false);
      }
      return;
    }
    onChange(choice.name);
    setOpen(false);
    setQuery("");
  };

  const totalRows = filtered.length + (showCreateRow ? 1 : 0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(totalRows - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx < filtered.length) commit(filtered[activeIdx]);
      else if (showCreateRow) commit({ create: query.trim() });
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger — either the selected value or a placeholder. Clicking
          it opens the dropdown and focuses the search input. */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          // Wait a tick so the input mounts before focus.
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className={cn(
          "w-full flex items-center justify-between gap-2 bg-[#1a1a1a] border border-[#333] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "truncate text-left flex-1",
            value ? "text-white" : "text-[#777]",
          )}
        >
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-[#777] hover:text-white"
              aria-label="Clear"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn(
              "text-[#777] transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Dropdown — absolutely positioned below the trigger. */}
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[#141414] border border-[#333] rounded-lg shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[#2a2a2a]">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="w-full bg-transparent text-white text-sm outline-none placeholder:text-[#666]"
            />
          </div>

          <div className="max-h-[240px] overflow-y-auto">
            {isLoading && filtered.length === 0 ? (
              <div className="px-4 py-3 flex items-center gap-2 text-[#888] text-xs">
                <Loader2 size={12} className="animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 && !showCreateRow ? (
              <div className="px-4 py-3 text-[#666] text-xs italic">
                No matches.
              </div>
            ) : (
              <>
                {filtered.map((opt, i) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => commit(opt)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm text-[#f0f0f0] flex items-center justify-between",
                      i === activeIdx ? "bg-[#dc2626]/15" : "hover:bg-white/5",
                      opt.name === value && "text-[#dc2626] font-semibold",
                    )}
                  >
                    <span className="truncate">{opt.name}</span>
                    {opt.name === value && (
                      <span className="text-[10px] text-[#dc2626]">Selected</span>
                    )}
                  </button>
                ))}
                {showCreateRow && (
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => commit({ create: query.trim() })}
                    onMouseEnter={() => setActiveIdx(filtered.length)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm flex items-center gap-2 border-t border-[#2a2a2a]",
                      activeIdx === filtered.length
                        ? "bg-[#dc2626]/15 text-[#dc2626]"
                        : "text-[#a0a0a0] hover:bg-white/5",
                    )}
                  >
                    {creating ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Plus size={12} />
                    )}
                    Add "{query.trim()}"
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
