"use client";

// Admin — edit an existing chat group. Two tabs:
//   * Details — name, avatar, description, announcement-only toggle
//   * Members — roster + add/remove
// Roles are read-only for now (no backend endpoint yet).

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Info,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { useUploadImage } from "@/lib/hooks/useAdmin";
import {
  useAdminGetGroup,
  useAdminUpdateGroup,
  useAdminRemoveGroupMember,
  useAdminSetAnnouncementOnly,
  type AdminChatGroup,
} from "@/lib/hooks/useChatGroups";
import { AddMembersModal } from "./AddMembersModal";

type Tab = "details" | "members";

interface Props {
  group: AdminChatGroup;
  onClose: () => void;
}

export function EditGroupModal({ group, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const { data: detail, isLoading, isError } = useAdminGetGroup(group.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani truncate">
              Edit Group
            </h3>
            <p className="text-xs text-[#606060] mt-0.5 truncate">{group.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#606060] hover:text-[#f0f0f0]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a2a] bg-[#181818]">
          <TabButton active={tab === "details"} onClick={() => setTab("details")}>
            <Info size={14} /> Details
          </TabButton>
          <TabButton active={tab === "members"} onClick={() => setTab("members")}>
            <Users size={14} /> Members {detail?.members?.length ? `(${detail.members.length})` : ""}
          </TabButton>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-[#606060] text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : isError || !detail ? (
            <div className="p-6 text-center text-xs text-red-400">
              Failed to load group.
            </div>
          ) : tab === "details" ? (
            <DetailsTab group={detail} onClose={onClose} />
          ) : (
            <MembersTab groupId={group.id} groupName={detail.name} members={detail.members} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-5 py-3 text-[11px] font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors ${
        active
          ? "text-[#f0f0f0] border-[#dc2626]"
          : "text-[#606060] border-transparent hover:text-[#a0a0a0]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Details tab ─────────────────────────────────────────────────────────────

function DetailsTab({
  group,
  onClose,
}: {
  group: AdminChatGroup;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name ?? "");
  const [description, setDescription] = useState(group.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(group.avatarUrl ?? null);
  const [announcementOnly, setAnnouncementOnly] = useState<boolean>(
    !!group.announcementOnly,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = useUploadImage();
  const updateGroup = useAdminUpdateGroup();
  const setAnnouncement = useAdminSetAnnouncementOnly();

  // Re-seed form when we get fresh data (e.g. after add/remove members reopens).
  useEffect(() => {
    setName(group.name ?? "");
    setDescription(group.description ?? "");
    setAvatarUrl(group.avatarUrl ?? null);
    setAnnouncementOnly(!!group.announcementOnly);
  }, [group.id, group.name, group.description, group.avatarUrl, group.announcementOnly]);

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

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Enter a group name.");
      return;
    }
    setSaving(true);
    try {
      // Persist announcement-only via its dedicated endpoint only if it changed.
      const announcementChanged =
        !!announcementOnly !== !!group.announcementOnly;

      await updateGroup.mutateAsync({
        id: group.id,
        name: name.trim(),
        description: description.trim() || null,
        avatarUrl,
      });
      if (announcementChanged) {
        await setAnnouncement.mutateAsync({
          id: group.id,
          announcementOnly,
        });
      }
      toast.success("Group updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 space-y-5">
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickAvatar}
          />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
              Group name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
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

      {/* Announcement-only toggle */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-[#2a2a2a] bg-[#181818] p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Megaphone size={14} className="text-[#dc2626] flex-shrink-0" />
            <span className="text-sm font-bold text-[#f0f0f0]">Announcement only</span>
          </div>
          <p className="text-xs text-[#a0a0a0] mt-1">
            When enabled, only members with the <code className="text-[#f0f0f0]">admin</code> role
            can post messages. Everyone else can still read and react.
          </p>
        </div>
        <ToggleSwitch
          checked={announcementOnly}
          onChange={setAnnouncementOnly}
          ariaLabel="Announcement only"
        />
      </div>

      {/* Footer inside body */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || uploading}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Members tab ─────────────────────────────────────────────────────────────

interface MemberRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  businessName: string | null;
  role: string;
  joinedAt: string;
}

function MembersTab({
  groupId,
  groupName,
  members,
}: {
  groupId: string;
  groupName: string;
  members: MemberRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const removeMember = useAdminRemoveGroupMember();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  function onRemove(m: MemberRow) {
    const label = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "this member";
    if (!confirm(`Remove ${label} from the group?`)) return;
    setPendingRemoveId(m.id);
    removeMember.mutate(
      { id: groupId, memberId: m.id },
      {
        onSuccess: () => toast.success("Member removed"),
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Remove failed"),
        onSettled: () => setPendingRemoveId(null),
      },
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
            Roster
          </div>
          <div className="text-xs text-[#a0a0a0] mt-1">
            {members.length} {members.length === 1 ? "member" : "members"}
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani"
        >
          <Plus size={14} /> Add Members
        </button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-6 text-center">
          <p className="text-xs text-[#606060]">This group has no members yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] divide-y divide-[#2a2a2a]">
          {members.map((m) => {
            const name = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "Member";
            const isRemoving = pendingRemoveId === m.id;
            return (
              <div key={m.id} className="flex items-center gap-3 p-3">
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
                  {m.businessName && (
                    <div className="text-[11px] text-[#606060] truncate">{m.businessName}</div>
                  )}
                </div>
                {/* Role select — read-only for now. */}
                <div
                  title="Role changes require a backend endpoint — contact the backend team to change roles."
                  className="flex-shrink-0"
                >
                  <select
                    value={m.role === "admin" ? "admin" : "member"}
                    disabled
                    aria-label="Role (read-only)"
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-8 px-2 text-[11px] font-bold uppercase tracking-widest text-[#a0a0a0] font-rajdhani cursor-not-allowed opacity-70"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button
                  onClick={() => onRemove(m)}
                  disabled={isRemoving}
                  aria-label={`Remove ${name}`}
                  className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-[#1a1a1a] disabled:opacity-50"
                >
                  {isRemoving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddMembersModal
          groupId={groupId}
          groupName={groupName}
          existingMemberIds={members.map((m) => m.id)}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// ── Toggle switch ───────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 h-6 w-11 rounded-full transition-colors ${
        checked ? "bg-[#dc2626]" : "bg-[#333]"
      }`}
    >
      <span
        className={`inline-block w-5 h-5 rounded-full bg-white transform transition-transform mt-0.5 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
