"use client";

import { memberDisplayName } from "@/lib/hooks/useCommunity";

interface MemberAvatarProps {
  member?: {
    firstName?: string | null;
    lastName?: string | null;
    profilePhotoUrl?: string | null;
  } | null;
  size?: number;
  onClick?: () => void;
  ringColor?: string;
}

/**
 * Circular avatar for a community member. Falls back to an initials
 * disc coloured by the accent variable when no profilePhotoUrl is set.
 */
export function MemberAvatar({
  member,
  size = 40,
  onClick,
  ringColor,
}: MemberAvatarProps) {
  const name = memberDisplayName(member);
  const initial = name.slice(0, 1).toUpperCase();
  const photo = member?.profilePhotoUrl;

  const inner = photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={name}
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: "var(--color-accent)",
      }}
    >
      {initial}
    </div>
  );

  const wrapperStyle = ringColor
    ? {
        padding: 2,
        borderRadius: "9999px",
        background: ringColor,
        display: "inline-block",
      }
    : undefined;

  const content = wrapperStyle ? <div style={wrapperStyle}>{inner}</div> : inner;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${name}'s profile`}
        className="flex-shrink-0 rounded-full outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      >
        {content}
      </button>
    );
  }
  return <span className="flex-shrink-0">{content}</span>;
}
