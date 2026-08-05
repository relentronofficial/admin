"use client";

import { useEffect } from "react";
import { Loader2, MapPin, UserMinus, UserPlus, X } from "lucide-react";

import { useMe } from "@/lib/hooks/useUser";
import { useMemberProfile, useToggleFollow, memberDisplayName } from "@/lib/hooks/useCommunity";

import { MemberAvatar } from "./MemberAvatar";

interface AuthorProfileSheetProps {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AuthorProfileSheet({
  memberId,
  open,
  onClose,
}: AuthorProfileSheetProps) {
  const { data: me } = useMe();
  const { data: profile, isLoading, isError } = useMemberProfile(
    memberId ?? "",
    open && !!memberId,
  );
  const toggleFollow = useToggleFollow(memberId ?? "");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !memberId) return null;

  const isMe = me?.id === memberId;
  const roleLine =
    profile?.member.businessType && profile.member.businessName
      ? `${profile.member.businessType} · ${profile.member.businessName}`
      : profile?.member.businessName ??
        profile?.member.businessType ??
        (profile?.member.city ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">Profile</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-surface-overlay)]"
            aria-label="Close"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : isError || !profile ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Could not load this profile.
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <MemberAvatar member={profile.member} size={72} />
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-foreground">
                  {memberDisplayName(profile.member)}
                </div>
                {roleLine && (
                  <div className="text-xs text-muted-foreground mt-0.5">{roleLine}</div>
                )}
                {profile.member.city && (
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin size={11} />
                    {profile.member.city}
                    {profile.member.state ? `, ${profile.member.state}` : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div
              className="flex items-center justify-around py-3 rounded-xl"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <Stat label="Posts" value={profile.postsCount} />
              <div className="w-px h-8" style={{ background: "var(--color-border-subtle)" }} />
              <Stat label="Followers" value={profile.followersCount} />
              <div className="w-px h-8" style={{ background: "var(--color-border-subtle)" }} />
              <Stat label="Following" value={profile.followingCount} />
            </div>

            {/* Follow button */}
            {!isMe && (
              <button
                onClick={() => toggleFollow.mutate()}
                disabled={toggleFollow.isPending}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={
                  profile.isFollowing
                    ? {
                        color: "var(--color-text-secondary)",
                        background: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border-subtle)",
                      }
                    : {
                        color: "#fff",
                        background: "var(--color-accent)",
                      }
                }
              >
                {profile.isFollowing ? (
                  <>
                    <UserMinus size={14} /> Following
                  </>
                ) : (
                  <>
                    <UserPlus size={14} /> Follow
                  </>
                )}
              </button>
            )}

            {/* Recent posts */}
            {profile.recentPosts.length > 0 && (
              <div>
                <div
                  className="text-[11px] font-bold tracking-wider mb-2"
                  style={{ color: "#FFD4AF" }}
                >
                  RECENT POSTS
                </div>
                <div className="space-y-2">
                  {profile.recentPosts.slice(0, 3).map((rp) => (
                    <div
                      key={rp.id}
                      className="p-3 rounded-xl"
                      style={{
                        background: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                        {rp.content}
                      </p>
                      {rp.mediaUrls.length > 0 && (
                        <div className="mt-2 flex gap-1">
                          {rp.mediaUrls.slice(0, 3).map((u, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${u}-${i}`}
                              src={u}
                              alt=""
                              className="w-14 h-14 rounded object-cover"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
