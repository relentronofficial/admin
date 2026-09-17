"use client";

import { useState, useRef, useEffect } from "react";
import {
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileWarning,
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Video,
  Radio,
  Ban,
  Users,
  Upload,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListMembers, useGetMember, useApproveMember } from "@/lib/hooks/useMembers";
import { useListAdmins, useCreateBunnyVideo } from "@/lib/hooks/useAdmin";
import {
  useRejectOnboarding,
  useRequestOnboardingChanges,
  useListOnboardingContent,
  useCreateOnboardingContent,
  useUpdateOnboardingContent,
  useDeleteOnboardingContent,
  useReorderOnboardingContent,
} from "@/lib/hooks/useOnboarding";
import {
  useListOnboardingMeetings,
  useGetOnboardingMeeting,
  useCreateOnboardingMeeting,
  useStartOnboardingMeeting,
  useEndOnboardingMeeting,
  useCancelOnboardingMeeting,
  useGetOnboardingMeetingHostToken,
  useOnboardingMeetingStatus,
} from "@/lib/hooks/useOnboardingMeetings";
import { AdminOnboardingMeetingRoom } from "@/components/AdminOnboardingMeetingRoom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Status config — the 4 admin-visible states from the spec ─────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  under_review: { label: "Pending Review", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Clock },
  verified: { label: "Approved", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "#dc2626", bg: "rgba(220,38,38,0.12)", Icon: XCircle },
  changes_requested: { label: "Changes Required", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", Icon: FileWarning },
  awaiting_kyc: { label: "Not Submitted", color: "#606060", bg: "rgba(96,96,96,0.12)", Icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.awaiting_kyc;
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

const MEETING_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  scheduled: { label: "Scheduled", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Clock },
  live: { label: "Live", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: Radio },
  completed: { label: "Completed", color: "#a0a0a0", bg: "rgba(160,160,160,0.12)", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "#dc2626", bg: "rgba(220,38,38,0.12)", Icon: Ban },
};

function MeetingStatusBadge({ status }: { status: string }) {
  const cfg = MEETING_STATUS_CONFIG[status] ?? MEETING_STATUS_CONFIG.scheduled;
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─── Schedule Meeting modal ─────────────────────────────────────────────────

function ScheduleMeetingModal({ memberId, memberLabel, onClose }: { memberId: string; memberLabel: string; onClose: () => void }) {
  const { data: adminsData } = useListAdmins({ limit: 100 });
  const admins: any[] = adminsData?.data ?? [];
  const create = useCreateOnboardingMeeting();

  const [title, setTitle] = useState("Onboarding Verification Call");
  const [description, setDescription] = useState("");
  const [hostAdminId, setHostAdminId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);

  const handleSubmit = async () => {
    if (!scheduledAt) { window.alert("Pick a date/time for the call."); return; }
    await create.mutateAsync({
      memberId,
      hostAdminId: hostAdminId || undefined,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">Schedule Verification Call</h3>
        <p className="text-xs text-[#888]">For {memberLabel}</p>

        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626]" />
        <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] resize-none" />

        <select value={hostAdminId} onChange={(e) => setHostAdminId(e.target.value)} className="w-full h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626]">
          <option value="">Assign host (optional)</option>
          {admins.map((a: any) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-3">
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] outline-none focus:border-[#dc2626]" />
          <input type="number" min={5} max={240} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} placeholder="Duration (min)" className="h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] outline-none focus:border-[#dc2626]" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0]">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40">
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Meetings list (reused by both the per-application section and the global tab) ──

// Live participant count for the dashboard list — wires the previously-unused
// useOnboardingMeetingStatus hook in; only polls while the meeting is live.
function LiveParticipantCount({ meetingId, status }: { meetingId: string; status: string }) {
  const { data } = useOnboardingMeetingStatus(meetingId, status === "live");
  if (status !== "live") return <span className="text-[#606060]">—</span>;
  const count = data?.data?.participantCount;
  return (
    <span className="inline-flex items-center gap-1 text-[#a0a0a0]">
      <Users size={11} /> {typeof count === "number" ? count : "…"}
    </span>
  );
}

function MeetingRow({ meeting, onOpenRoom, onOpenDetail }: { meeting: any; onOpenRoom: (creds: any, title: string) => void; onOpenDetail: (id: string) => void }) {
  const start = useStartOnboardingMeeting();
  const end = useEndOnboardingMeeting();
  const cancel = useCancelOnboardingMeeting();
  const getHostToken = useGetOnboardingMeetingHostToken();

  const handleJoin = async () => {
    const creds = await getHostToken.mutateAsync(meeting.id);
    onOpenRoom({ ...creds, meetingId: meeting.id }, meeting.title);
  };
  const handleStart = async () => { await start.mutateAsync(meeting.id); };
  const handleEnd = async () => {
    if (!window.confirm("End this meeting for everyone?")) return;
    await end.mutateAsync(meeting.id);
  };
  const handleCancel = async () => {
    const reason = window.prompt("Reason for cancelling this meeting:");
    if (!reason || !reason.trim()) return;
    await cancel.mutateAsync({ id: meeting.id, reason: reason.trim() });
  };

  return (
    <tr className="border-b border-[#1f1f1f] last:border-b-0 hover:bg-[#161616] transition-colors cursor-pointer" onClick={() => onOpenDetail(meeting.id)}>
      <td className="px-4 py-3">
        <p className="text-[#f0f0f0] text-xs font-medium">{meeting.title}</p>
        {meeting.member && <p className="text-[#888] text-[11px]">{meeting.member.firstName} {meeting.member.lastName ?? ""}</p>}
      </td>
      <td className="px-4 py-3 text-[#a0a0a0] text-xs">{format(new Date(meeting.scheduledAt), "dd MMM yyyy, HH:mm")}</td>
      <td className="px-4 py-3 text-[#a0a0a0] text-xs">{meeting.hostAdmin?.fullName ?? "—"}</td>
      <td className="px-4 py-3 text-xs"><LiveParticipantCount meetingId={meeting.id} status={meeting.status} /></td>
      <td className="px-4 py-3"><MeetingStatusBadge status={meeting.status} /></td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {(meeting.status === "scheduled" || meeting.status === "live") && (
            <button onClick={handleJoin} disabled={getHostToken.isPending} className="px-2.5 h-7 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest rounded bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40">
              <Video size={11} /> Join
            </button>
          )}
          {meeting.status === "scheduled" && (
            <button onClick={handleStart} disabled={start.isPending} className="px-2.5 h-7 text-[10px] font-bold uppercase tracking-widest rounded border border-[#22c55e] text-[#22c55e] hover:bg-[rgba(34,197,94,0.1)] disabled:opacity-40">
              Start
            </button>
          )}
          {meeting.status === "live" && (
            <button onClick={handleEnd} disabled={end.isPending} className="px-2.5 h-7 text-[10px] font-bold uppercase tracking-widest rounded border border-[#7f1d1d] text-[#dc2626] hover:bg-[rgba(220,38,38,0.1)] disabled:opacity-40">
              End
            </button>
          )}
          {meeting.status === "scheduled" && (
            <button onClick={handleCancel} disabled={cancel.isPending} className="px-2.5 h-7 text-[10px] font-bold uppercase tracking-widest rounded border border-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] disabled:opacity-40">
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function MeetingsList({
  meetings,
  onOpenRoom,
  onOpenDetail,
}: {
  memberId?: string;
  meetings: any[];
  onOpenRoom: (creds: any, title: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  if (meetings.length === 0) {
    return <div className="flex items-center justify-center py-10 text-[#888] text-sm">No meetings yet</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#2a2a2a]">
          {["Meeting", "Scheduled", "Host", "Participants", "Status", ""].map((h) => (
            <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {meetings.map((m: any) => <MeetingRow key={m.id} meeting={m} onOpenRoom={onOpenRoom} onOpenDetail={onOpenDetail} />)}
      </tbody>
    </table>
  );
}

// ─── Meeting detail modal ────────────────────────────────────────────────

function MeetingDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useGetOnboardingMeeting(id);
  const meeting = data?.data;

  const fmt = (d: string | null | undefined) => (d ? format(new Date(d), "dd MMM yyyy, HH:mm:ss") : "—");
  const durationLabel = (() => {
    if (!meeting?.startedAt) return "—";
    const end = meeting.endedAt ? new Date(meeting.endedAt).getTime() : Date.now();
    const secs = Math.max(0, Math.floor((end - new Date(meeting.startedAt).getTime()) / 1000));
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  })();

  return (
    <div className="fixed inset-0 z-[999] bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        {isLoading || !meeting ? (
          <div className="py-10 text-center text-[#888] text-sm">Loading…</div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">{meeting.title}</h3>
                {meeting.description && <p className="text-xs text-[#888] mt-1">{meeting.description}</p>}
              </div>
              <MeetingStatusBadge status={meeting.status} />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex justify-between border-b border-[#1f1f1f] pb-1.5"><span className="text-[#888]">Member</span><span className="text-[#f0f0f0]">{meeting.member?.firstName} {meeting.member?.lastName ?? ""}</span></div>
              <div className="flex justify-between border-b border-[#1f1f1f] pb-1.5"><span className="text-[#888]">Host</span><span className="text-[#f0f0f0]">{meeting.hostAdmin?.fullName ?? "—"}</span></div>
              <div className="flex justify-between border-b border-[#1f1f1f] pb-1.5"><span className="text-[#888]">Scheduled</span><span className="text-[#f0f0f0]">{fmt(meeting.scheduledAt)}</span></div>
              <div className="flex justify-between border-b border-[#1f1f1f] pb-1.5"><span className="text-[#888]">Started</span><span className="text-[#f0f0f0]">{fmt(meeting.startedAt)}</span></div>
              <div className="flex justify-between border-b border-[#1f1f1f] pb-1.5"><span className="text-[#888]">Ended</span><span className="text-[#f0f0f0]">{fmt(meeting.endedAt)}</span></div>
              <div className="flex justify-between border-b border-[#1f1f1f] pb-1.5"><span className="text-[#888]">Duration</span><span className="text-[#f0f0f0]">{durationLabel}</span></div>
              {meeting.status === "cancelled" && (
                <div className="flex justify-between border-b border-[#1f1f1f] pb-1.5 col-span-2"><span className="text-[#888]">Cancel reason</span><span className="text-[#f0f0f0]">{meeting.cancelReason ?? "—"}</span></div>
              )}
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-2">Participants ({meeting.participants?.length ?? 0})</h4>
              <div className="rounded-lg border border-[#2a2a2a] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2a2a] bg-[#111]">
                      {["Name", "Role", "Status", "Joined", "Left"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(meeting.participants ?? []).map((p: any) => (
                      <tr key={p.id} className="border-b border-[#1f1f1f] last:border-b-0">
                        <td className="px-3 py-2 text-[#f0f0f0]">{p.member ? `${p.member.firstName} ${p.member.lastName ?? ""}` : p.admin?.fullName ?? "—"}</td>
                        <td className="px-3 py-2 text-[#888] capitalize">{p.role}</td>
                        <td className="px-3 py-2 text-[#888] capitalize">{p.status}</td>
                        <td className="px-3 py-2 text-[#888]">{p.joinedAt ? format(new Date(p.joinedAt), "HH:mm:ss") : "—"}</td>
                        <td className="px-3 py-2 text-[#888]">{p.leftAt ? format(new Date(p.leftAt), "HH:mm:ss") : "—"}</td>
                      </tr>
                    ))}
                    {(!meeting.participants || meeting.participants.length === 0) && (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-[#888]">No participants</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={onClose} className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0]">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PROFILE_DISPLAY_FIELDS: { key: string; label: string }[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "businessName", label: "Business Name" },
  { key: "productServiceType", label: "Business Type" },
  { key: "businessStartedFrom", label: "Business Started From" },
  { key: "teamSize", label: "Total Team Members" },
  { key: "preferredSessionMode", label: "Preferred Session Mode" },
  { key: "instagramLink", label: "Instagram Link" },
  { key: "instagramStats", label: "Instagram Posts & Followers" },
  { key: "facebookStats", label: "Facebook Posts & Followers" },
  { key: "websiteUrl", label: "Website Link" },
  { key: "annualTurnover", label: "Revenue Until Now" },
  { key: "revenueGoalAfterTbt", label: "Revenue Goal After TBT" },
  { key: "goalAfter90Days", label: "Learning Goals" },
  { key: "gstNumber", label: "GST Number" },
];

// ─── Application detail / review ────────────────────────────────────────────

function ApplicationDetail({ id, onBack, onOpenRoom, onOpenDetail }: { id: string; onBack: () => void; onOpenRoom: (creds: any, title: string) => void; onOpenDetail: (id: string) => void }) {
  const { data, isLoading } = useGetMember(id);
  const member: any = data?.data;
  const approve = useApproveMember();
  const reject = useRejectOnboarding();
  const requestChanges = useRequestOnboardingChanges();
  const [note, setNote] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const { data: meetingsData } = useListOnboardingMeetings({ memberId: id });
  const meetings: any[] = meetingsData?.data ?? [];

  const canReview = member?.verificationStatus === "under_review";

  const handleApprove = async () => {
    if (!window.confirm(`Approve ${member?.firstName} ${member?.lastName ?? ""}? This activates their account.`)) return;
    await approve.mutateAsync({ id, data: {} });
  };

  const handleReject = async () => {
    if (!note.trim()) { window.alert("A reason is required to reject an application."); return; }
    if (!window.confirm("Reject this application? The member will see this reason.")) return;
    await reject.mutateAsync({ id, reason: note.trim() });
    setNote("");
  };

  const handleRequestChanges = async () => {
    if (!note.trim()) { window.alert("A note is required to request changes."); return; }
    if (!window.confirm("Send this application back for changes?")) return;
    await requestChanges.mutateAsync({ id, note: note.trim() });
    setNote("");
  };

  if (isLoading) return <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>;
  if (!member) return <div className="flex items-center justify-center py-16 text-[#888] text-sm">Application not found</div>;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-[#888] hover:text-[#f0f0f0] transition-colors"
      >
        <ArrowLeft size={13} /> Back to applications
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">
            {member.firstName} {member.lastName ?? ""}
          </h2>
          <p className="text-xs text-[#888] mt-0.5">{member.memberId}</p>
        </div>
        <StatusBadge status={member.verificationStatus} />
      </div>

      {member.onboardingReviewNote && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-3 text-xs text-[#a0a0a0]">
          <span className="text-[#606060] uppercase tracking-widest text-[10px] font-bold">Last admin note</span>
          <p className="mt-1">{member.onboardingReviewNote}</p>
        </div>
      )}

      {/* Profile summary */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-3">Submitted Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {PROFILE_DISPLAY_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex justify-between text-xs border-b border-[#1f1f1f] pb-2">
              <span className="text-[#888]">{label}</span>
              <span className="text-[#f0f0f0] text-right">{member[key] || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-3">Documents</h3>
        {(!member.kycDocuments || member.kycDocuments.length === 0) ? (
          <p className="text-xs text-[#888]">No documents submitted</p>
        ) : (
          <div className="space-y-2">
            {member.kycDocuments.map((doc: any) => (
              <a
                key={doc.id}
                href={doc.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] transition-colors"
              >
                <FileText size={13} className="text-[#dc2626]" />
                {doc.documentType}
                <span className="text-[#606060] uppercase text-[10px]">({doc.status})</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Verification meeting */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Verification Meeting</h3>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white"
          >
            <Video size={12} /> Schedule Call
          </button>
        </div>
        <div className="rounded-lg border border-[#2a2a2a] overflow-hidden">
          <MeetingsList memberId={id} meetings={meetings} onOpenRoom={onOpenRoom} onOpenDetail={onOpenDetail} />
        </div>
      </div>
      {showScheduleModal && (
        <ScheduleMeetingModal
          memberId={id}
          memberLabel={`${member.firstName} ${member.lastName ?? ""}`}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {/* Review actions */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Review</h3>
        {!canReview ? (
          <p className="text-xs text-[#888]">
            {member.verificationStatus === "verified"
              ? "This application has already been approved."
              : "This application isn't currently awaiting review."}
          </p>
        ) : (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for Reject / Request Changes — explain what's wrong or missing…"
              rows={3}
              className="w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] resize-none"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleApprove}
                disabled={approve.isPending}
                className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#22c55e] hover:bg-green-600 text-white disabled:opacity-40 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={requestChanges.isPending}
                className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#8b5cf6] text-[#8b5cf6] hover:bg-[rgba(139,92,246,0.1)] disabled:opacity-40 transition-colors"
              >
                Request Changes
              </button>
              <button
                onClick={handleReject}
                disabled={reject.isPending}
                className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#dc2626] text-[#dc2626] hover:bg-[rgba(220,38,38,0.1)] disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Applications tab ───────────────────────────────────────────────────────

function ApplicationsTab({ onOpenRoom, onOpenDetail }: { onOpenRoom: (creds: any, title: string) => void; onOpenDetail: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("under_review");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const LIMIT = 25;

  const { data, isLoading } = useListMembers({
    page,
    limit: LIMIT,
    search,
    facets: statusFilter ? { verificationStatus: [statusFilter] } : undefined,
  });

  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  if (selectedId) return <ApplicationDetail id={selectedId} onBack={() => setSelectedId(null)} onOpenRoom={onOpenRoom} onOpenDetail={onOpenDetail} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, phone, email…"
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] w-64"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
          >
            <option value="under_review">Pending Review</option>
            <option value="verified">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="changes_requested">Changes Required</option>
            <option value="">All statuses</option>
          </select>
        </div>
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <UserCheck size={32} className="text-[#666]" />
            <p className="text-[#888] text-sm">No applications found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {["Member", "Phone", "Status", "Submitted"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m: any, i: number) => (
                <tr
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors cursor-pointer",
                    i === rows.length - 1 && "border-b-0"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="text-[#f0f0f0] font-medium text-xs">{m.firstName} {m.lastName ?? ""}</p>
                    <p className="text-[#888] text-[11px]">{m.businessName ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-[#a0a0a0] text-xs">{m.phone}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.verificationStatus} /></td>
                  <td className="px-4 py-3 text-[#a0a0a0] text-xs">
                    {m.onboardingSubmittedAt ? format(new Date(m.onboardingSubmittedAt), "dd MMM yyyy, HH:mm") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#888]">{total} applications total</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-[#a0a0a0]">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Content tab (admin-authored onboarding step text/audio/video/image/quiz) ─

type QuizOption = { id: string; text: string; correct: boolean };
type QuizQuestion = { id: string; question: string; options: QuizOption[]; explanation: string };

const EMPTY_FORM = { stepKey: "", title: "", textBody: "", videoUrl: "", audioUrl: "", imageUrl: "", lottieUrl: "", sortOrder: 0 };

function QuizPreview({ questions }: { questions: QuizQuestion[] }) {
  if (!questions?.length) return <p className="text-xs text-[#888] p-4">No questions</p>;
  return (
    <div className="p-4 bg-[#0a0a0a] space-y-4">
      {questions.map((q: any, qi: number) => (
        <div key={q.id ?? qi} className="space-y-2">
          <p className="text-xs text-[#f0f0f0] font-medium">{qi + 1}. {q.question}</p>
          <div className="space-y-1 pl-3">
            {(q.options ?? []).map((opt: any) => (
              <div key={opt.id} className={cn("flex items-center gap-2 text-xs", opt.correct ? "text-[#22c55e]" : "text-[#888]")}>
                <span className="font-mono w-4">{opt.id?.toUpperCase()}.</span>
                <span>{opt.text}</span>
                {opt.correct && <span className="text-[10px] font-bold">(correct)</span>}
              </div>
            ))}
          </div>
          {q.explanation && (
            <p className="text-[11px] text-[#606060] pl-3 italic">{q.explanation}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Meetings tab (centralized Live Meetings dashboard) ────────────────────

function MemberPickerModal({ onSelect, onClose }: { onSelect: (id: string, label: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const { data } = useListMembers({ page: 1, limit: 10, search });
  const rows: any[] = data?.data ?? [];
  return (
    <div className="fixed inset-0 z-[999] bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">Select Member</h3>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email…"
          className="w-full h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626]"
        />
        <div className="max-h-64 overflow-y-auto divide-y divide-[#1f1f1f]">
          {rows.map((m: any) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id, `${m.firstName} ${m.lastName ?? ""}`)}
              className="w-full text-left px-2 py-2.5 hover:bg-[#1a1a1a] rounded transition-colors"
            >
              <p className="text-xs text-[#f0f0f0]">{m.firstName} {m.lastName ?? ""}</p>
              <p className="text-[11px] text-[#888]">{m.phone}</p>
            </button>
          ))}
          {rows.length === 0 && <p className="text-xs text-[#888] py-4 text-center">No members found</p>}
        </div>
      </div>
    </div>
  );
}

function MeetingsTab({ onOpenRoom, onOpenDetail }: { onOpenRoom: (creds: any, title: string) => void; onOpenDetail: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState("scheduled");
  const [showPicker, setShowPicker] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<{ id: string; label: string } | null>(null);
  const { data, isLoading } = useListOnboardingMeetings({ status: statusFilter || undefined, limit: 50 });
  const meetings: any[] = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {["scheduled", "live", "completed", "cancelled", ""].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 h-8 text-[11px] font-bold uppercase tracking-widest rounded-full border transition-colors",
                statusFilter === s ? "bg-[#dc2626] border-[#dc2626] text-white" : "border-[#2a2a2a] text-[#888] hover:text-[#f0f0f0]"
              )}
            >
              {s ? MEETING_STATUS_CONFIG[s]?.label ?? s : "All"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-1.5 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white"
        >
          <Plus size={13} /> Schedule Meeting
        </button>
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>
        ) : (
          <MeetingsList meetings={meetings} onOpenRoom={onOpenRoom} onOpenDetail={onOpenDetail} />
        )}
      </div>

      {showPicker && (
        <MemberPickerModal
          onClose={() => setShowPicker(false)}
          onSelect={(id, label) => { setScheduleTarget({ id, label }); setShowPicker(false); }}
        />
      )}
      {scheduleTarget && (
        <ScheduleMeetingModal
          memberId={scheduleTarget.id}
          memberLabel={scheduleTarget.label}
          onClose={() => setScheduleTarget(null)}
        />
      )}
    </div>
  );
}

function ContentTab() {
  const { data, isLoading } = useListOnboardingContent();
  const create = useCreateOnboardingContent();
  const update = useUpdateOnboardingContent();
  const del = useDeleteOnboardingContent();
  const reorder = useReorderOnboardingContent();
  const createBunnyVideo = useCreateBunnyVideo();
  const serverRows: any[] = data?.data ?? [];

  // DnD reorder state
  const [localRows, setLocalRows] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => { setLocalRows(serverRows); setIsDirty(false); }, [data]);

  const onDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { setDragOver(null); return; }
    const next = [...localRows];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalRows(next);
    setIsDirty(true);
    dragIdx.current = null;
    setDragOver(null);
  };

  const moveRow = (from: number, to: number) => {
    if (to < 0 || to >= localRows.length) return;
    const next = [...localRows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalRows(next);
    setIsDirty(true);
  };

  const handleSaveOrder = async () => {
    await reorder.mutateAsync(localRows.map((r) => r.id));
    setIsDirty(false);
  };

  // Quiz preview state
  const [previewQuizId, setPreviewQuizId] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [quizQs, setQuizQs] = useState<QuizQuestion[]>([]);
  const [showQuizBuilder, setShowQuizBuilder] = useState(false);

  // Video upload state
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleVideoUpload = async (file: File) => {
    try {
      setVideoUploading(true);
      setUploadProgress(0);
      const { videoId, tusUploadUrl, tusHeaders, embedUrl } = await createBunnyVideo.mutateAsync({
        title: form.title || file.name,
      });
      const { Upload: TusUpload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new TusUpload(file, {
          endpoint: tusUploadUrl,
          headers: {
            AuthorizationSignature: tusHeaders.AuthorizationSignature,
            AuthorizationExpire: String(tusHeaders.AuthorizationExpire),
            VideoId: tusHeaders.VideoId,
            LibraryId: tusHeaders.LibraryId,
          },
          chunkSize: 5 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000],
          metadata: { filetype: file.type, title: form.title || file.name },
          onProgress(b: number, t: number) { setUploadProgress(Math.round((b / t) * 100)); },
          onSuccess() { resolve(); },
          onError(err: any) { reject(err); },
        });
        upload.start();
      });
      void videoId;
      setForm((f) => ({ ...f, videoUrl: embedUrl }));
    } catch (e: any) {
      window.alert(e.message || "Video upload failed");
    } finally {
      setVideoUploading(false);
      setUploadProgress(0);
    }
  };

  const addQuestion = () => setQuizQs((qs) => [
    ...qs,
    {
      id: Date.now().toString(),
      question: "",
      explanation: "",
      options: [
        { id: "a", text: "", correct: true },
        { id: "b", text: "", correct: false },
        { id: "c", text: "", correct: false },
        { id: "d", text: "", correct: false },
      ],
    },
  ]);

  const removeQuestion = (id: string) => setQuizQs((qs) => qs.filter((q) => q.id !== id));
  const updateQuestion = (id: string, field: string, val: string) =>
    setQuizQs((qs) => qs.map((q) => (q.id === id ? { ...q, [field]: val } : q)));
  const updateOption = (qId: string, optId: string, val: string) =>
    setQuizQs((qs) => qs.map((q) => q.id === qId ? { ...q, options: q.options.map((o) => o.id === optId ? { ...o, text: val } : o) } : q));
  const setCorrect = (qId: string, optId: string) =>
    setQuizQs((qs) => qs.map((q) => q.id === qId ? { ...q, options: q.options.map((o) => ({ ...o, correct: o.id === optId })) } : q));

  const handleCreate = async () => {
    if (!form.stepKey.trim() || !form.title.trim()) { window.alert("Step key and title are required."); return; }
    const quizData = quizQs.length > 0 ? { questions: quizQs } : undefined;
    await create.mutateAsync({ ...form, quizData, isActive: true } as any);
    setForm({ ...EMPTY_FORM });
    setQuizQs([]);
    setShowQuizBuilder(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete onboarding step "${title}"? This cannot be undone.`)) return;
    await del.mutateAsync(id);
  };

  const inputCls = "h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] w-full";

  return (
    <div className="space-y-5">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Add Step Content</h3>

        {/* Basic fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <input placeholder="Step key (e.g. introduction)" value={form.stepKey} onChange={(e) => setForm({ ...form, stepKey: e.target.value })} className={inputCls} />
            <p className="mt-1 text-[11px] text-[#555]">
              Use <code className="text-[#888]">introduction</code> to show before the profile step, or <code className="text-[#888]">guided_instructions</code> to show after document upload.
            </p>
          </div>
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          <input
            type="number"
            placeholder="Sort order (0 = first)"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <textarea placeholder="Text body" value={form.textBody} onChange={(e) => setForm({ ...form, textBody: e.target.value })} rows={3} className="w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] resize-none" />

        {/* Media URLs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={videoUploading}
                className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50"
              >
                {videoUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                {videoUploading
                  ? uploadProgress > 0 ? `${uploadProgress}%` : "Preparing…"
                  : "Upload to Bunny"}
              </button>
              {form.videoUrl?.includes("iframe.mediadelivery.net") && (
                <span className="text-[10px] text-green-500 font-rajdhani font-bold uppercase tracking-widest">Bunny Stream ✓</span>
              )}
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ""; }} />
            </div>
            <input placeholder="Or paste video URL (HLS/embed, optional)" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} className={inputCls} />
          </div>
          <input placeholder="Audio URL (optional)" value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Image URL (hero illustration, optional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className={inputCls} />
          <input placeholder="Lottie URL (.json animation, optional)" value={form.lottieUrl} onChange={(e) => setForm({ ...form, lottieUrl: e.target.value })} className={inputCls} />
        </div>

        {/* Quiz builder */}
        <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowQuizBuilder((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#a0a0a0] hover:text-[#f0f0f0] transition-colors"
          >
            <span>Quiz Builder {quizQs.length > 0 && `(${quizQs.length} question${quizQs.length > 1 ? "s" : ""})`}</span>
            <span>{showQuizBuilder ? "▲" : "▼"}</span>
          </button>
          {showQuizBuilder && (
            <div className="border-t border-[#2a2a2a] p-4 space-y-4">
              {quizQs.map((q, qi) => (
                <div key={q.id} className="bg-[#0f0f0f] border border-[#333] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Question {qi + 1}</span>
                    <button onClick={() => removeQuestion(q.id)} className="text-[#dc2626] hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                  <input
                    placeholder="Question text"
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                    className={inputCls}
                  />
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={opt.correct}
                          onChange={() => setCorrect(q.id, opt.id)}
                          className="accent-[#dc2626]"
                          title="Mark as correct answer"
                        />
                        <input
                          placeholder={`Option ${opt.id.toUpperCase()}`}
                          value={opt.text}
                          onChange={(e) => updateOption(q.id, opt.id, e.target.value)}
                          className="flex-1 h-9 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626]"
                        />
                        {opt.correct && <span className="text-[10px] text-[#22c55e] font-bold uppercase">✓ Correct</span>}
                      </div>
                    ))}
                  </div>
                  <input
                    placeholder="Explanation (shown after answering)"
                    value={q.explanation}
                    onChange={(e) => updateQuestion(q.id, "explanation", e.target.value)}
                    className={inputCls}
                  />
                </div>
              ))}
              <button
                onClick={addQuestion}
                className="inline-flex items-center gap-2 px-3 h-8 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#444] transition-colors"
              >
                <Plus size={12} /> Add Question
              </button>
            </div>
          )}
        </div>

        <button onClick={handleCreate} disabled={create.isPending} className="inline-flex items-center gap-2 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 transition-colors">
          <Plus size={13} /> Add Step
        </button>
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isDirty && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[rgba(220,38,38,0.06)]">
            <p className="text-xs text-[#a0a0a0]">Drag rows to reorder. Changes are local until saved.</p>
            <button
              onClick={handleSaveOrder}
              disabled={reorder.isPending}
              className="px-4 h-8 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 transition-colors"
            >
              {reorder.isPending ? "Saving…" : "Save Order"}
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-[#888] text-sm">Loading…</div>
        ) : localRows.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[#888] text-sm">No onboarding content yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="w-8 px-2 py-3" />
                {["Step Key", "Title", "Media", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localRows.map((row: any, i: number) => (
                <>
                  <tr
                    key={row.id}
                    draggable
                    onDragStart={() => { dragIdx.current = i; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                    onDrop={(e) => onDrop(e, i)}
                    onDragLeave={() => setDragOver(null)}
                    className={cn(
                      "border-b border-[#1f1f1f] transition-colors",
                      i === localRows.length - 1 && previewQuizId !== row.id && "border-b-0",
                      dragOver === i && "border-t-2 border-t-[#dc2626]",
                    )}
                  >
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1">
                        <GripVertical size={14} className="text-[#444] cursor-grab active:cursor-grabbing" />
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveRow(i, i - 1)}
                            disabled={i === 0}
                            className="text-[#555] hover:text-[#a0a0a0] disabled:opacity-20 transition-colors"
                            title="Move up"
                          >
                            <ChevronUp size={11} />
                          </button>
                          <button
                            onClick={() => moveRow(i, i + 1)}
                            disabled={i === localRows.length - 1}
                            className="text-[#555] hover:text-[#a0a0a0] disabled:opacity-20 transition-colors"
                            title="Move down"
                          >
                            <ChevronDown size={11} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs font-mono">{row.stepKey}</td>
                    <td className="px-4 py-3 text-[#f0f0f0] text-xs">{row.title}</td>
                    <td className="px-4 py-3 text-[#888] text-xs">
                      {[
                        row.lottieUrl && "lottie",
                        row.imageUrl && "image",
                        row.videoUrl && "video",
                        row.audioUrl && "audio",
                        row.quizData && "quiz",
                      ].filter(Boolean).join(", ") || "text only"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => update.mutateAsync({ id: row.id, data: { isActive: !row.isActive } })}
                        className={cn("text-[11px] font-bold uppercase px-2 py-1 rounded-full", row.isActive ? "text-[#22c55e] bg-[rgba(34,197,94,0.12)]" : "text-[#888] bg-[rgba(136,136,136,0.12)]")}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {row.quizData?.questions?.length > 0 && (
                          <button
                            onClick={() => setPreviewQuizId((id) => id === row.id ? null : row.id)}
                            className="text-[#888] hover:text-[#f0f0f0] transition-colors"
                            title="Preview quiz"
                          >
                            {previewQuizId === row.id ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        <button onClick={() => handleDelete(row.id, row.title)} className="text-[#dc2626] hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {previewQuizId === row.id && row.quizData && (
                    <tr key={`${row.id}-quiz`} className={cn("border-b border-[#1f1f1f]", i === localRows.length - 1 && "border-b-0")}>
                      <td colSpan={6} className="p-0">
                        <QuizPreview questions={row.quizData.questions ?? []} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [tab, setTab] = useState<"applications" | "meetings" | "content">("applications");
  const [hostCallCreds, setHostCallCreds] = useState<{ token: string; wsUrl: string; roomName: string; meetingId: string; title: string; startedAt?: string | null } | null>(null);
  const [detailMeetingId, setDetailMeetingId] = useState<string | null>(null);

  const handleOpenRoom = (creds: any, title: string) => {
    setHostCallCreds({ ...creds, title });
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest flex items-center gap-2">
            <UserCheck size={20} className="text-[#dc2626]" />
            Onboarding
          </h1>
          <p className="text-xs text-[#888] mt-0.5">Self-onboarding applications, live verification meetings, and instructional content</p>
        </div>

        <div className="flex gap-1 border-b border-[#2a2a2a]">
          {(["applications", "meetings", "content"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-xs font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors",
                tab === t ? "text-[#dc2626] border-[#dc2626]" : "text-[#888] border-transparent hover:text-[#f0f0f0]"
              )}
            >
              {t === "applications" ? "Applications" : t === "meetings" ? "Live Meetings" : "Content"}
            </button>
          ))}
        </div>

        {tab === "applications" ? (
          <ApplicationsTab onOpenRoom={handleOpenRoom} onOpenDetail={setDetailMeetingId} />
        ) : tab === "meetings" ? (
          <MeetingsTab onOpenRoom={handleOpenRoom} onOpenDetail={setDetailMeetingId} />
        ) : (
          <ContentTab />
        )}
      </div>

      {hostCallCreds && (
        <AdminOnboardingMeetingRoom
          token={hostCallCreds.token}
          wsUrl={hostCallCreds.wsUrl}
          meetingId={hostCallCreds.meetingId}
          meetingTitle={hostCallCreds.title}
          startedAt={hostCallCreds.startedAt}
          onLeave={() => setHostCallCreds(null)}
        />
      )}
      {detailMeetingId && <MeetingDetailModal id={detailMeetingId} onClose={() => setDetailMeetingId(null)} />}
    </DashboardLayout>
  );
}
