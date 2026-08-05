"use client";

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";

import { useLikers, memberDisplayName } from "@/lib/hooks/useCommunity";

import { MemberAvatar } from "./MemberAvatar";

export function LikersSheet({
  postId,
  open,
  onClose,
  onOpenAuthor,
}: {
  postId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenAuthor: (memberId: string) => void;
}) {
  const { data: likers = [], isLoading } = useLikers(postId ?? "", open && !!postId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !postId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-sm max-h-[70vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">Likes</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-surface-overlay)]" aria-label="Close">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : likers.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No likes yet.
            </div>
          ) : (
            likers.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onClose();
                  onOpenAuthor(m.id);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-surface-overlay)] text-left"
              >
                <MemberAvatar member={m} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {memberDisplayName(m)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
