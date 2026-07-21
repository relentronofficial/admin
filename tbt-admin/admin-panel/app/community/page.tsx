"use client";

/**
 * Community moderation — All / Pending / Approved posts with approve /
 * pin / delete actions and inline comment viewer.
 */

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListCommunityPosts,
  useApproveCommunityPost,
  usePinCommunityPost,
  useDeleteCommunityPost,
  useListPostComments,
  useListCommunityReports,
  useUpdateCommunityReport,
  type CommunityPost,
  type CommunityReport,
} from "@/lib/hooks/useCommunity";
import { toast } from "react-hot-toast";
import {
  Users,
  Loader2,
  Check,
  X,
  Pin,
  PinOff,
  Trash2,
  MessageSquare,
  Heart,
  Clock,
  Flag,
} from "lucide-react";

type Tab = "all" | "pending" | "approved" | "reports";

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isLoading, isFetching } = useListCommunityPosts({
    page,
    limit,
  });

  const allPosts = data?.data ?? [];
  const filtered =
    tab === "all"
      ? allPosts
      : tab === "pending"
        ? allPosts.filter((p) => !p.isApproved)
        : allPosts.filter((p) => p.isApproved);

  const total = data?.meta?.total ?? 0;
  const pendingCount = allPosts.filter((p) => !p.isApproved).length;
  const approvedCount = allPosts.filter((p) => p.isApproved).length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
              <Users className="text-[#dc2626]" size={24} /> Community
            </h1>
            <p className="text-[12px] text-[#888] mt-1">
              Moderate member posts before they appear in the mobile feed.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-3 gap-2 mb-5">
          <StatChip label="Total on Page" value={filtered.length} />
          <StatChip label="Pending" value={pendingCount} />
          <StatChip label="Approved" value={approvedCount} />
        </div>

        <div className="flex items-center gap-1 border-b border-[#2a2a2a] mb-5">
          {(
            [
              { id: "pending", label: "Pending Review" },
              { id: "approved", label: "Approved" },
              { id: "all", label: "All Posts" },
              { id: "reports", label: "Reports" },
            ] as { id: Tab; label: string }[]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors " +
                  (active
                    ? "border-[#dc2626] text-white"
                    : "border-transparent text-[#888] hover:text-white")
                }
              >
                {t.label}
                {t.id === "pending" && pendingCount > 0 && (
                  <span className="bg-[#dc2626] text-white rounded-full px-1.5 py-0.5 text-[9px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "reports" ? (
          <ReportsTab />
        ) : isLoading ? (
          <div className="p-16 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={20} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-[#666] text-[13px]">
            No {tab === "all" ? "" : tab + " "}posts.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}

        {tab !== "reports" && total > limit && (
          <div className="flex items-center justify-between mt-4 text-[11px] text-[#888]">
            <span>
              Page {page} of {Math.max(1, Math.ceil(total / limit))}
              {isFetching && (
                <Loader2 className="inline animate-spin ml-2" size={12} />
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-md bg-[#181818] border border-[#2a2a2a] text-[10px] font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= total}
                className="px-3 py-1.5 rounded-md bg-[#181818] border border-[#2a2a2a] text-[10px] font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Individual post card ──────────────────────────────────────────

function PostCard({ post }: { post: CommunityPost }) {
  const approve = useApproveCommunityPost();
  const pin = usePinCommunityPost();
  const del = useDeleteCommunityPost();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const memberName = post.member
    ? [post.member.firstName, post.member.lastName]
        .filter((s): s is string => !!s && s.length > 0)
        .join(" ")
        .trim() || "Unknown"
    : "Unknown";
  const when = new Date(post.createdAt);
  const whenStr =
    when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const doApprove = async (isApproved: boolean) => {
    try {
      await approve.mutateAsync({ id: post.id, isApproved });
      toast.success(isApproved ? "Approved" : "Un-approved");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Failed");
    }
  };
  const doPin = async () => {
    try {
      await pin.mutateAsync({ id: post.id, isPinned: !post.isPinned });
      toast.success(post.isPinned ? "Un-pinned" : "Pinned");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Failed");
    }
  };
  const doDelete = async () => {
    if (!confirm("Delete this post permanently? Comments cascade.")) return;
    try {
      await del.mutateAsync(post.id);
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Failed");
    }
  };

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex-shrink-0 overflow-hidden flex items-center justify-center">
          {post.member?.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.member.profilePhotoUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[13px] text-[#666] font-bold">
              {memberName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px] font-semibold text-white truncate">
              {memberName}
            </span>
            {post.isMentor && (
              <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/40">
                Mentor
              </span>
            )}
            {post.isPinned && (
              <Pin size={12} className="text-[#dc2626]" />
            )}
            {post.isApproved ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold bg-green-500/10 text-green-400">
                Approved
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold bg-orange-500/10 text-orange-400">
                Pending
              </span>
            )}
            <span className="text-[11px] text-[#666] ml-auto flex items-center gap-1">
              <Clock size={11} /> {whenStr}
            </span>
          </div>
          <div className="text-[13px] text-[#d0d0d0] whitespace-pre-wrap mb-2 leading-relaxed">
            {post.content}
          </div>
          {post.mediaUrls.length > 0 && (
            <div className="flex gap-2 mb-2">
              {post.mediaUrls.slice(0, 4).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover border border-[#2a2a2a]"
                />
              ))}
              {post.mediaUrls.length > 4 && (
                <div className="w-20 h-20 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] flex items-center justify-center text-[11px] text-[#666]">
                  +{post.mediaUrls.length - 4}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 text-[11px] text-[#888]">
            <span className="flex items-center gap-1">
              <Heart size={12} /> {post.likesCount}
            </span>
            <button
              onClick={() => setCommentsOpen((v) => !v)}
              className="flex items-center gap-1 hover:text-white"
            >
              <MessageSquare size={12} /> {post.commentsCount}
            </button>
          </div>

          {commentsOpen && (
            <CommentsList postId={post.id} />
          )}
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          {!post.isApproved && (
            <button
              onClick={() => doApprove(true)}
              disabled={approve.isPending}
              className="p-1.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40"
              title="Approve"
            >
              <Check size={14} />
            </button>
          )}
          {post.isApproved && (
            <button
              onClick={() => doApprove(false)}
              disabled={approve.isPending}
              className="p-1.5 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-40"
              title="Un-approve"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={doPin}
            disabled={pin.isPending}
            className={
              "p-1.5 rounded " +
              (post.isPinned
                ? "bg-[#dc2626]/15 text-[#dc2626] hover:bg-[#dc2626]/25"
                : "bg-[#0f0f0f] text-[#888] hover:text-white")
            }
            title={post.isPinned ? "Un-pin" : "Pin"}
          >
            {post.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            onClick={doDelete}
            disabled={del.isPending}
            className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentsList({ postId }: { postId: string }) {
  const { data: comments = [], isLoading } = useListPostComments(postId);
  if (isLoading) {
    return (
      <div className="mt-3 pl-3 border-l-2 border-[#2a2a2a] text-[11px] text-[#666]">
        <Loader2 className="inline animate-spin" size={11} />
      </div>
    );
  }
  if (comments.length === 0) {
    return (
      <div className="mt-3 pl-3 border-l-2 border-[#2a2a2a] text-[11px] text-[#666]">
        No comments.
      </div>
    );
  }
  return (
    <div className="mt-3 pl-3 border-l-2 border-[#2a2a2a] space-y-2">
      {comments.map((c) => {
        const cname = c.member
          ? [c.member.firstName, c.member.lastName]
              .filter((s): s is string => !!s && s.length > 0)
              .join(" ")
              .trim() || "Unknown"
          : "Unknown";
        return (
          <div key={c.id} className="text-[12px]">
            <span className="font-bold text-white">{cname}</span>
            <span className="text-[#666] ml-2 text-[10px]">
              {new Date(c.createdAt).toLocaleString()}
            </span>
            <div className="text-[#d0d0d0] leading-relaxed mt-0.5">
              {c.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2">
      <div className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
        {label}
      </div>
      <div className="text-lg font-bold text-white tracking-tight">{value}</div>
    </div>
  );
}

// ── Reports moderation (item #25) ─────────────────────────────────

function ReportsTab() {
  const [status, setStatus] = useState<
    "pending" | "resolved" | "dismissed" | "all"
  >("pending");
  const { data, isLoading } = useListCommunityReports({ status, limit: 100 });
  const rows = data?.data ?? [];
  const update = useUpdateCommunityReport();

  const setStatusAndRefresh = (
    s: "pending" | "resolved" | "dismissed" | "all",
  ) => setStatus(s);

  return (
    <>
      <div className="flex items-center gap-1 mb-3">
        {(
          [
            { id: "pending" as const, label: "Pending" },
            { id: "resolved" as const, label: "Resolved" },
            { id: "dismissed" as const, label: "Dismissed" },
            { id: "all" as const, label: "All" },
          ]
        ).map((s) => {
          const active = status === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setStatusAndRefresh(s.id)}
              className={
                "text-[10px] font-bold uppercase tracking-widest font-rajdhani px-3 py-1.5 rounded-md border " +
                (active
                  ? "bg-[#dc2626]/15 text-[#dc2626] border-[#dc2626]"
                  : "bg-[#181818] text-[#888] border-[#2a2a2a] hover:text-white")
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-[#666]">
          <Loader2 className="inline animate-spin" size={20} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-16 text-center text-[#666] text-[13px]">
          No {status === "all" ? "" : status + " "}reports.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              busy={update.isPending}
              onResolve={async (next) => {
                try {
                  await update.mutateAsync({ id: r.id, status: next });
                  toast.success(
                    next === "resolved" ? "Marked resolved" : "Dismissed",
                  );
                } catch (err: any) {
                  toast.error(
                    err?.response?.data?.error?.message ?? "Failed",
                  );
                }
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ReportCard({
  report,
  busy,
  onResolve,
}: {
  report: CommunityReport;
  busy: boolean;
  onResolve: (next: "resolved" | "dismissed" | "pending") => void;
}) {
  const reporterName = report.reporter
    ? [report.reporter.firstName, report.reporter.lastName]
        .filter((s): s is string => !!s && s.length > 0)
        .join(" ")
        .trim() || "Unknown"
    : "Anonymous";
  const authorName = report.post?.member
    ? [report.post.member.firstName, report.post.member.lastName]
        .filter((s): s is string => !!s && s.length > 0)
        .join(" ")
        .trim() || "Unknown"
    : "Unknown";
  const when = new Date(report.createdAt);
  const whenStr =
    when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#dc2626]/15 border border-[#dc2626]/40 flex items-center justify-center flex-shrink-0">
          <Flag size={18} className="text-[#dc2626]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold bg-[#dc2626]/10 text-[#dc2626]">
              {report.reason}
            </span>
            <span
              className={
                "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold " +
                (report.status === "pending"
                  ? "bg-orange-500/10 text-orange-400"
                  : report.status === "resolved"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-white/5 text-[#888]")
              }
            >
              {report.status}
            </span>
            <span className="text-[11px] text-[#666] ml-auto flex items-center gap-1">
              <Clock size={11} /> {whenStr}
            </span>
          </div>
          <div className="text-[12px] text-[#a0a0a0] mb-2">
            Reported by <span className="text-white font-bold">{reporterName}</span>
          </div>
          {report.detail && (
            <div className="text-[13px] text-[#d0d0d0] italic mb-3 pl-3 border-l-2 border-[#2a2a2a]">
              &ldquo;{report.detail}&rdquo;
            </div>
          )}
          {report.post && (
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3 mb-3">
              <div className="text-[11px] text-[#666] mb-1">
                Post by <span className="text-white">{authorName}</span>
              </div>
              <div className="text-[13px] text-[#d0d0d0] whitespace-pre-wrap leading-relaxed">
                {report.post.content}
              </div>
              {report.post.mediaUrls.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {report.post.mediaUrls.slice(0, 3).map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={u}
                      alt=""
                      className="w-16 h-16 rounded object-cover border border-[#2a2a2a]"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {report.status === "pending" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onResolve("resolved")}
                disabled={busy}
                className="text-[11px] px-3 py-1.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40 flex items-center gap-1.5"
              >
                <Check size={12} /> Mark resolved
              </button>
              <button
                onClick={() => onResolve("dismissed")}
                disabled={busy}
                className="text-[11px] px-3 py-1.5 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-[#888] hover:text-white font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40 flex items-center gap-1.5"
              >
                <X size={12} /> Dismiss
              </button>
            </div>
          )}
          {report.status !== "pending" && (
            <button
              onClick={() => onResolve("pending")}
              disabled={busy}
              className="text-[11px] px-3 py-1.5 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-[#888] hover:text-white font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40"
            >
              Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
