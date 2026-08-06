"use client";

// Admin — pick members to add to an existing chat group.
// Filters out members already in the group (passed via `existingMemberIds`).

import { useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";

import { useListMembers } from "@/lib/hooks/useMembers";
import { useAdminAddGroupMembers } from "@/lib/hooks/useChatGroups";

interface Member {
  id: string;
  firstName: string;
  lastName?: string | null;
  profilePhotoUrl?: string | null;
  memberId?: string | null;
  city?: string | null;
}

interface Props {
  groupId: string;
  groupName: string;
  existingMemberIds: string[];
  onClose: () => void;
}

export function AddMembersModal({ groupId, groupName, existingMemberIds, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: memberData, isLoading } = useListMembers({
    page: 1,
    limit: 500,
    search,
    status: "active",
  });
  const addMembers = useAdminAddGroupMembers();

  const existing = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);
  const members: Member[] = useMemo(() => {
    const raw = (memberData as { data?: Member[] } | undefined)?.data ?? [];
    // Only render members who aren't already in the group.
    return raw.filter((m) => !existing.has(m.id));
  }, [memberData, existing]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      toast.error("Pick at least one member.");
      return;
    }
    setBusy(true);
    try {
      await addMembers.mutateAsync({ id: groupId, memberIds: Array.from(selected) });
      toast.success(`Added ${selected.size} ${selected.size === 1 ? "member" : "members"}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <div>
            <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">
              Add Members
            </h3>
            <p className="text-xs text-[#606060] mt-0.5 truncate max-w-[24rem]">to {groupName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-[#606060] hover:text-[#f0f0f0] disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-[#2a2a2a] space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search active members…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 pl-9 pr-3 text-sm text-white outline-none focus:border-[#dc2626]"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest font-rajdhani">
            <span className="text-[#606060]">
              {existingMemberIds.length} already in group
            </span>
            <span className="text-[#f0f0f0]">{selected.size} selected</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-[#606060]">
              <Loader2 size={14} className="animate-spin mx-auto mb-2" />
              Loading members…
            </div>
          ) : members.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#606060]">
              {search
                ? "No matching members not already in the group."
                : "Every active member is already in the group."}
            </div>
          ) : (
            members.map((m) => {
              const checked = selected.has(m.id);
              const name = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "Member";
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    checked ? "bg-[#dc2626]/10" : "hover:bg-[#1a1a1a]"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1a1a1a] flex-shrink-0 flex items-center justify-center">
                    {m.profilePhotoUrl ? (
                      <Image
                        src={m.profilePhotoUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-white">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#f0f0f0] truncate">{name}</div>
                    <div className="text-[11px] text-[#606060] truncate">
                      {m.memberId ?? ""} {m.city ? `· ${m.city}` : ""}
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center ${
                      checked ? "bg-[#dc2626]" : "border border-[#333]"
                    }`}
                  >
                    {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a2a] bg-[#181818]">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || selected.size === 0}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Add {selected.size > 0 ? `${selected.size}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
