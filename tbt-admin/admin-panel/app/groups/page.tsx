"use client";

// Admin group-chat management (WhatsApp-inspired).

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, MessageSquare, Plus, Search, Trash2, Users, X } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListMembers } from "@/lib/hooks/useMembers";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import {
  useAdminCreateGroup,
  useAdminDeleteGroup,
  useAdminListGroups,
  type AdminChatGroup,
} from "@/lib/hooks/useChatGroups";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

interface Member {
  id: string;
  firstName: string;
  lastName?: string | null;
  profilePhotoUrl?: string | null;
  memberId?: string | null;
  city?: string | null;
}

export default function AdminGroupsPage() {
  const { data: groups = [], isLoading } = useAdminListGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const deleteGroup = useAdminDeleteGroup();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">
              Group Chats
            </h1>
            <p className="text-sm text-[#a0a0a0] mt-1">
              WhatsApp-style broadcast + discussion groups for members.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani"
          >
            <Plus size={16} /> Create Group
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-14 text-[#606060] text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading groups…
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#181818] p-10 text-center">
            <Users size={26} className="mx-auto text-[#606060] mb-3" />
            <p className="text-sm text-[#a0a0a0]">No groups yet — create your first one.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#181818] divide-y divide-[#2a2a2a]">
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                onDelete={() => {
                  if (confirm(`Delete "${g.name}"? This removes the group and every message.`)) {
                    deleteGroup.mutate(g.id, {
                      onSuccess: () => toast.success("Group deleted"),
                      onError: () => toast.error("Delete failed"),
                    });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen && <CreateGroupModal onClose={() => setCreateOpen(false)} />}
    </DashboardLayout>
  );
}

function GroupRow({ group, onDelete }: { group: AdminChatGroup; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-12 h-12 rounded-full flex-shrink-0 bg-[#1a1a1a] overflow-hidden flex items-center justify-center">
        {group.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Users size={20} className="text-[#606060]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-[#f0f0f0]">{group.name}</div>
        <div className="text-[11px] text-[#606060] uppercase tracking-widest font-rajdhani mt-0.5">
          {group.memberCount ?? 0} members · {group.messageCount ?? 0} messages
        </div>
        {group.description && (
          <div className="text-xs text-[#a0a0a0] mt-1 line-clamp-1">{group.description}</div>
        )}
      </div>
      <div className="text-[11px] text-[#606060] uppercase tracking-widest">
        {formatDistanceToNow(new Date(group.lastMessageAt), { addSuffix: true })}
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete group"
        className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-[#1a1a1a]"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = useUploadImage();
  const createGroup = useAdminCreateGroup();
  const { data: memberData, isLoading: membersLoading } = useListMembers({
    page: 1,
    limit: 100,
    search,
    status: "active",
  });

  const members: Member[] = useMemo(() => {
    const raw = (memberData as { data?: Member[] } | undefined)?.data ?? [];
    return raw;
  }, [memberData]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImage.mutateAsync({
        file,
        pathPrefix: "chat-group-avatars",
      });
      setAvatarUrl(res.publicUrl);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Enter a group name.");
      return;
    }
    if (selected.size === 0) {
      toast.error("Pick at least one member.");
      return;
    }
    setBusy(true);
    try {
      await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        avatarUrl,
        memberIds: Array.from(selected),
      });
      toast.success("Group created");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">
            Create Group
          </h3>
          <button onClick={onClose} disabled={busy} className="text-[#606060] hover:text-[#f0f0f0] disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Avatar + name row */}
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users size={24} className="text-[#606060]" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#dc2626] hover:bg-red-700 text-white flex items-center justify-center disabled:opacity-70"
                aria-label="Upload avatar"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                  Group name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cohort 12 · Q3 planning"
                  className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                  Description (optional)
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this group is about"
                  className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]"
                />
              </div>
            </div>
          </div>

          {/* Member picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                Members
              </label>
              <span className="text-[11px] font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">
                {selected.size} selected
              </span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 pl-9 pr-3 text-sm text-white outline-none focus:border-[#dc2626]"
              />
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#2a2a2a] bg-[#0f0f0f]">
              {membersLoading ? (
                <div className="p-6 text-center text-xs text-[#606060]">Loading…</div>
              ) : members.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#606060]">No active members found.</div>
              ) : (
                members.map((m) => {
                  const checked = selected.has(m.id);
                  const name = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "Member";
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleMember(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        checked ? "bg-[#dc2626]/10" : "hover:bg-[#1a1a1a]"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1a1a1a] flex-shrink-0 flex items-center justify-center">
                        {m.profilePhotoUrl ? (
                          <Image src={m.profilePhotoUrl} alt="" width={36} height={36} className="w-full h-full object-cover" />
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
          </div>
        </div>

        {/* Footer */}
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
            disabled={busy || uploading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}
