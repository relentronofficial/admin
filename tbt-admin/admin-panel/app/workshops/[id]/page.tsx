"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Plus, Trash2, Pencil, X, AlertCircle,
  Video, BookOpen, Users, MessageSquare, ClipboardList,
  CheckCircle2, Clock, ChevronRight, Settings, Workflow,
  GripVertical, BarChart2, Save, BookMarked, PhoneCall, FileText, ChevronDown, Search, Upload,
} from "lucide-react";
import { useCreateBunnyVideo } from "@/lib/hooks/useAdmin";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetWorkshop, useUpdateWorkshop,
  useWorkshopChallenges, useWorkshopLiveCalls,
  useWorkshopAssignments, useWorkshopQA, useWorkshopEnrollments,
  useCreateChallenge, useUpdateChallenge, useDeleteChallenge,
  useCreateEpisode, useUpdateEpisode, useDeleteEpisode,
  useCreateLiveCall, useUpdateLiveCall, useDeleteLiveCall,
  useCreateAssignment, useUpdateAssignment, useDeleteAssignment,
  useReplyQA, useDeleteQAPost, useUpdateEnrollment, useDeleteEnrollment,
  useDeleteQAReply,
  useWorkshopFlow, useAddFlowItem, useUpdateFlowItem, useDeleteFlowItem, useReorderFlowItems,
  useEnrollMembers, useListSubmissions, useReorderChallengeEpisodes,
} from "@/lib/hooks/useTbt";
import { useListMembers } from "@/lib/hooks/useMembers";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

const TABS = [
  { id: "info", label: "Info & Labels", icon: Settings },
  { id: "flow", label: "Flow", icon: Workflow },
  { id: "challenges", label: "Challenges", icon: BookOpen },
  { id: "live-calls", label: "Live Calls", icon: Video },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "qa", label: "Q&A", icon: MessageSquare },
  { id: "enrollments", label: "Enrollments", icon: Users },
];

const EPISODE_TYPES = ["video", "assignment", "offer"];
const LOCK_ICON_TYPES = ["padlock", "lock", "none"];
const COMPLETED_ICON_TYPES = ["checkmark", "tick", "none"];
const ASSIGNMENT_ICON_TYPES = ["document", "clipboard"];
const LIVE_CALL_TYPES = [
  { value: "pre_requisite", label: "Pre-Requisite" },
  { value: "mid_review",    label: "Mid Review"    },
  { value: "celebration",   label: "Celebration"   },
  { value: "custom",        label: "Custom"        },
];

const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";
const labelCls = "block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani";
const selectCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none";

export default function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("info");

  const { data: workshopData, isLoading: workshopLoading, refetch: refetchWorkshop } = useGetWorkshop(id);
  const workshop = workshopData?.data;
  const updateWorkshop = useUpdateWorkshop();

  const { data: challengesData, refetch: refetchChallenges } = useWorkshopChallenges(id);
  const challenges = (challengesData as any)?.data || [];

  const { data: liveCallsData, refetch: refetchLiveCalls } = useWorkshopLiveCalls(id);
  const liveCalls = (liveCallsData as any)?.data || [];

  const { data: assignmentsData, refetch: refetchAssignments } = useWorkshopAssignments(id);
  const assignmentGroups = (assignmentsData as any)?.data || [];

  const [qaPage, setQaPage] = useState(1);
  const { data: qaData, refetch: refetchQA } = useWorkshopQA(id, qaPage);
  const qaPosts = (qaData as any)?.data || [];
  const qaMeta = (qaData as any)?.meta;

  const { data: enrollmentsData, refetch: refetchEnrollments } = useWorkshopEnrollments(id);
  const enrollments = (enrollmentsData as any)?.data || [];

  const { data: flowData, refetch: refetchFlow } = useWorkshopFlow(id);
  const flowItems = (flowData as any)?.data || [];

  const createChallenge = useCreateChallenge(id);
  const updateChallenge = useUpdateChallenge(id);
  const deleteChallenge = useDeleteChallenge(id);
  const createEpisode = useCreateEpisode(id);
  const updateEpisode = useUpdateEpisode(id);
  const deleteEpisode = useDeleteEpisode(id);
  const createLiveCall = useCreateLiveCall(id);
  const updateLiveCall = useUpdateLiveCall(id);
  const deleteLiveCall = useDeleteLiveCall(id);
  const createAssignment = useCreateAssignment(id);
  const updateAssignment = useUpdateAssignment(id);
  const deleteAssignment = useDeleteAssignment(id);
  const replyQA = useReplyQA(id);
  const deleteQAPost = useDeleteQAPost(id);
  const deleteQAReply = useDeleteQAReply(id);
  const updateEnrollment = useUpdateEnrollment(id);
  const deleteEnrollment = useDeleteEnrollment(id);
  const addFlowItem = useAddFlowItem(id);
  const updateFlowItem = useUpdateFlowItem(id);
  const deleteFlowItem = useDeleteFlowItem(id);
  const reorderFlowItems = useReorderFlowItems(id);
  const reorderChallengeEpisodes = useReorderChallengeEpisodes(id);
  const enrollMembers = useEnrollMembers(id);

  // ── Info/Labels tab state ─────────────────────────────────────────────
  const [labelsForm, setLabelsForm] = useState({
    tabChallengesLabel: "Challenges", tabQaLabel: "Q & A", tabAssignmentLabel: "Assignment",
    progressWidgetLabel: "Learning Progress", progressMilestoneCount: 3,
    workshopFlowLabel: "Workshop Flow", backLabel: "Back", backUrl: "/workshops",
  });

  useEffect(() => {
    if (workshop) {
      setLabelsForm({
        tabChallengesLabel: workshop.tabChallengesLabel || "Challenges",
        tabQaLabel: workshop.tabQaLabel || "Q & A",
        tabAssignmentLabel: workshop.tabAssignmentLabel || "Assignment",
        progressWidgetLabel: workshop.progressWidgetLabel || "Learning Progress",
        progressMilestoneCount: workshop.progressMilestoneCount || 3,
        workshopFlowLabel: workshop.workshopFlowLabel || "Workshop Flow",
        backLabel: workshop.backLabel || "Back",
        backUrl: workshop.backUrl || "/workshops",
      });
    }
  }, [workshop]);

  const handleSaveLabels = async () => {
    try {
      await updateWorkshop.mutateAsync({ id, data: labelsForm });
      toast.success("Labels saved");
      refetchWorkshop();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── Flow tab state ────────────────────────────────────────────────────
  const [localFlowItems, setLocalFlowItems] = useState<any[]>([]);
  const [flowIsDirty, setFlowIsDirty] = useState(false);
  const flowDragIdx = useRef<number | null>(null);
  const [flowDragOver, setFlowDragOver] = useState<number | null>(null);

  useEffect(() => { setLocalFlowItems(flowItems); setFlowIsDirty(false); }, [flowData]);

  const onFlowDragStart = (i: number) => { flowDragIdx.current = i; };
  const onFlowDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setFlowDragOver(i); };
  const onFlowDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = flowDragIdx.current;
    if (from === null || from === dropIdx) { setFlowDragOver(null); return; }
    const next = [...localFlowItems];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalFlowItems(next);
    setFlowIsDirty(true);
    flowDragIdx.current = null;
    setFlowDragOver(null);
  };
  const onFlowDragEnd = () => { flowDragIdx.current = null; setFlowDragOver(null); };

  const handleSaveFlowOrder = async () => {
    try {
      await reorderFlowItems.mutateAsync(localFlowItems.map((item: any) => item.id));
      setFlowIsDirty(false);
      toast.success("Flow order saved");
    } catch (err: any) { toast.error(err.message || "Failed to save order"); }
  };

  const [showFlowForm, setShowFlowForm] = useState(false);
  const [editingFlowItem, setEditingFlowItem] = useState<any>(null);
  const [flowForm, setFlowForm] = useState({ type: "custom", label: "", description: "", challengeId: "", liveCallId: "" });
  const [deletingFlowItem, setDeletingFlowItem] = useState<string | null>(null);
  const [showAddItemMenu, setShowAddItemMenu] = useState(false);
  const [flowInlineCreate, setFlowInlineCreate] = useState(false);
  const [flowInlineChallengeData, setFlowInlineChallengeData] = useState({ title: "", numberLabel: "", numberColor: "#dc2626" });
  const [flowInlineLiveCallData, setFlowInlineLiveCallData] = useState({ title: "", scheduledAt: "", label: "LIVE CALL:", labelColor: "#ff3d8b" });

  const openCreateFlow = (type = "custom") => {
    setFlowForm({ type, label: "", description: "", challengeId: "", liveCallId: "" });
    setFlowInlineCreate(false);
    setFlowInlineChallengeData({ title: "", numberLabel: "", numberColor: "#dc2626" });
    setFlowInlineLiveCallData({ title: "", scheduledAt: "", label: "LIVE CALL:", labelColor: "#ff3d8b" });
    setEditingFlowItem(null);
    setShowFlowForm(true);
  };
  const openEditFlow = (item: any) => {
    setFlowForm({ type: item.type, label: item.label || "", description: item.description || "", challengeId: item.challengeId || "", liveCallId: item.liveCallId || "" });
    setFlowInlineCreate(false);
    setEditingFlowItem(item);
    setShowFlowForm(true);
  };

  const handleSaveFlow = async () => {
    if (flowForm.type === "custom" && !flowForm.label) return toast.error("Label is required");
    if (flowForm.type === "challenge_start" && !flowInlineCreate && !flowForm.challengeId) return toast.error("Select a challenge");
    if (flowForm.type === "challenge_start" && flowInlineCreate && !flowInlineChallengeData.title) return toast.error("Challenge title is required");
    if (flowForm.type === "live_call" && !flowInlineCreate && !flowForm.liveCallId) return toast.error("Select a live call");
    if (flowForm.type === "live_call" && flowInlineCreate && !flowInlineLiveCallData.title) return toast.error("Live call title is required");
    if (flowForm.type === "live_call" && flowInlineCreate && !flowInlineLiveCallData.scheduledAt) return toast.error("Scheduled date is required");
    try {
      const data: any = { type: flowForm.type, description: flowForm.description || null };
      if (flowForm.type === "custom") { data.label = flowForm.label; }
      if (flowForm.type === "challenge_start") {
        let challengeId = flowForm.challengeId;
        let challengeLabel: string;
        if (flowInlineCreate) {
          const created = await createChallenge.mutateAsync(flowInlineChallengeData);
          challengeId = (created as any)?.data?.id;
          challengeLabel = flowInlineChallengeData.numberLabel || flowInlineChallengeData.title || "Challenge";
          refetchChallenges();
        } else {
          const ch = challenges.find((c: any) => c.id === challengeId);
          challengeLabel = ch?.numberLabel || ch?.title || "Challenge";
        }
        data.challengeId = challengeId;
        data.label = challengeLabel;
      }
      if (flowForm.type === "live_call") {
        let liveCallId = flowForm.liveCallId;
        let liveCallLabel: string;
        if (flowInlineCreate) {
          const lcData = {
            title: flowInlineLiveCallData.title,
            scheduledAt: new Date(flowInlineLiveCallData.scheduledAt).toISOString(),
            type: "custom",
            label: flowInlineLiveCallData.label,
            labelColor: flowInlineLiveCallData.labelColor,
            stayTunedMessage: "Stay tuned — the link will unlock before the session begins",
            stayTunedColor: "#00c4cc",
            liveUrlUnlocksMinutesBefore: 30,
          };
          const created = await createLiveCall.mutateAsync(lcData);
          liveCallId = (created as any)?.data?.id;
          liveCallLabel = flowInlineLiveCallData.title || "Live Call";
          refetchLiveCalls();
        } else {
          const lc = liveCalls.find((l: any) => l.id === liveCallId);
          liveCallLabel = lc?.title || "Live Call";
        }
        data.liveCallId = liveCallId;
        data.label = liveCallLabel;
      }
      if (editingFlowItem) {
        await updateFlowItem.mutateAsync({ itemId: editingFlowItem.id, data });
        toast.success("Flow item updated");
      } else {
        await addFlowItem.mutateAsync(data);
        toast.success("Flow item added");
      }
      setShowFlowForm(false); refetchFlow();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteFlow = async (itemId: string) => {
    try { await deleteFlowItem.mutateAsync(itemId); toast.success("Flow item deleted"); setDeletingFlowItem(null); refetchFlow(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── Challenge state ───────────────────────────────────────────────────
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<any>(null);
  const [challengeForm, setChallengeForm] = useState({ title: "", numberLabel: "", numberColor: "#dc2626", challengeNumber: 1, description: "" });
  const [numberLabelManual, setNumberLabelManual] = useState(false);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState<string | null>(null);

  // ── Episode DnD state ─────────────────────────────────────────────────
  const [localEpisodes, setLocalEpisodes] = useState<any[]>([]);
  const [episodesDirty, setEpisodesDirty] = useState(false);
  const epDragIdx = useRef<number | null>(null);
  const [epDragOver, setEpDragOver] = useState<number | null>(null);

  useEffect(() => {
    if (expandedChallenge) {
      const ch = challenges.find((c: any) => c.id === expandedChallenge);
      setLocalEpisodes(ch?.episodes || []);
      setEpisodesDirty(false);
    }
  }, [expandedChallenge, challengesData]);

  const onEpDragStart = (i: number) => { epDragIdx.current = i; };
  const onEpDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setEpDragOver(i); };
  const onEpDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = epDragIdx.current;
    if (from === null || from === dropIdx) { setEpDragOver(null); return; }
    const next = [...localEpisodes];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalEpisodes(next);
    setEpisodesDirty(true);
    epDragIdx.current = null;
    setEpDragOver(null);
  };
  const onEpDragEnd = () => { epDragIdx.current = null; setEpDragOver(null); };

  const handleSaveEpisodeOrder = async () => {
    if (!expandedChallenge) return;
    try {
      await reorderChallengeEpisodes.mutateAsync({ challengeId: expandedChallenge, ids: localEpisodes.map((e: any) => e.id) });
      setEpisodesDirty(false);
      toast.success("Episode order saved");
    } catch (err: any) { toast.error(err.message || "Failed to save order"); }
  };

  const openCreateChallenge = () => {
    const nextNum = challenges.length + 1;
    setChallengeForm({ title: "", numberLabel: `Challenge ${String(nextNum).padStart(2, "0")}:`, numberColor: "#dc2626", challengeNumber: nextNum, description: "" });
    setNumberLabelManual(false);
    setEditingChallenge(null);
    setShowChallengeForm(true);
  };
  const openEditChallenge = (c: any) => {
    setChallengeForm({ title: c.title, numberLabel: c.numberLabel || "", numberColor: c.numberColor || "#dc2626", challengeNumber: c.challengeNumber || 1, description: c.description || "" });
    setNumberLabelManual(true);
    setEditingChallenge(c);
    setShowChallengeForm(true);
  };

  const handleSaveChallenge = async () => {
    if (!challengeForm.title) return toast.error("Title is required");
    try {
      if (editingChallenge) { await updateChallenge.mutateAsync({ id: editingChallenge.id, data: challengeForm }); toast.success("Challenge updated"); }
      else { await createChallenge.mutateAsync(challengeForm); toast.success("Challenge created"); }
      setShowChallengeForm(false); refetchChallenges();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteChallenge = async (cid: string) => {
    try { await deleteChallenge.mutateAsync(cid); toast.success("Challenge deleted"); setDeletingChallenge(null); refetchChallenges(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── Episode state ─────────────────────────────────────────────────────
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [episodeChallengeId, setEpisodeChallengeId] = useState<string>("");
  const [editingEpisode, setEditingEpisode] = useState<any>(null);
  const [episodeForm, setEpisodeForm] = useState({ title: "", type: "video", typeLabel: "", videoUrl: "", bunnyVideoId: "", durationSeconds: "", lockIconType: "padlock", completedIconType: "checkmark" });
  const [deletingEpisode, setDeletingEpisode] = useState<string | null>(null);
  const epVideoInputRef = useRef<HTMLInputElement>(null);
  const [epVideoUploading, setEpVideoUploading] = useState(false);
  const [epUploadProgress, setEpUploadProgress] = useState(0);
  const createBunnyVideo = useCreateBunnyVideo();

  const openCreateEpisode = (challengeId: string) => {
    setEpisodeChallengeId(challengeId);
    setEpisodeForm({ title: "", type: "video", typeLabel: "", videoUrl: "", bunnyVideoId: "", durationSeconds: "", lockIconType: "padlock", completedIconType: "checkmark" });
    setEditingEpisode(null); setShowEpisodeForm(true);
  };
  const openEditEpisode = (ep: any, challengeId: string) => {
    setEpisodeChallengeId(challengeId);
    setEpisodeForm({ title: ep.title, type: ep.type || "video", typeLabel: ep.typeLabel || "", videoUrl: ep.videoUrl || "", bunnyVideoId: ep.bunnyVideoId || "", durationSeconds: ep.durationSeconds != null ? String(ep.durationSeconds) : "", lockIconType: ep.lockIconType || "padlock", completedIconType: ep.completedIconType || "checkmark" });
    setEditingEpisode(ep); setShowEpisodeForm(true);
  };

  const handleSaveEpisode = async () => {
    if (!episodeForm.title) return toast.error("Title is required");
    try {
      const normalizedVideoUrl = episodeForm.videoUrl
        ? episodeForm.videoUrl.replace(/https?:\/\/player\.mediadelivery\.net\/play\/(\d+)\/([\w-]+)/, 'https://iframe.mediadelivery.net/embed/$1/$2')
        : null;
      const epData: any = { title: episodeForm.title, type: episodeForm.type, typeLabel: episodeForm.typeLabel || null, videoUrl: normalizedVideoUrl, lockIconType: episodeForm.lockIconType, completedIconType: episodeForm.completedIconType };
      if (episodeForm.durationSeconds) epData.durationSeconds = Number(episodeForm.durationSeconds);
      if (episodeForm.bunnyVideoId) epData.bunnyVideoId = episodeForm.bunnyVideoId;
      if (editingEpisode) { await updateEpisode.mutateAsync({ id: editingEpisode.id, data: epData }); toast.success("Episode updated"); }
      else { await createEpisode.mutateAsync({ challengeId: episodeChallengeId, data: epData }); toast.success("Episode created"); }
      setShowEpisodeForm(false); refetchChallenges();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteEpisode = async (epId: string) => {
    try { await deleteEpisode.mutateAsync(epId); toast.success("Episode deleted"); setDeletingEpisode(null); refetchChallenges(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleEpisodeVideoUpload = async (file: File) => {
    try {
      setEpVideoUploading(true);
      setEpUploadProgress(0);
      const titleForUpload = episodeForm.title || file.name;
      const { videoId, tusUploadUrl, tusHeaders, embedUrl } = await createBunnyVideo.mutateAsync({
        title: titleForUpload,
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
          metadata: { filetype: file.type, title: titleForUpload },
          onProgress(bytesUploaded: number, bytesTotal: number) {
            setEpUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess() { resolve(); },
          onError(err: any) { reject(err); },
        });
        upload.start();
      });
      setEpisodeForm(f => ({ ...f, videoUrl: embedUrl, bunnyVideoId: videoId }));
      toast.success("Video uploaded to Bunny Stream");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setEpVideoUploading(false);
      setEpUploadProgress(0);
    }
  };

  // ── Live Call state ───────────────────────────────────────────────────
  const [showLiveCallForm, setShowLiveCallForm] = useState(false);
  const [editingLiveCall, setEditingLiveCall] = useState<any>(null);
  const [liveCallForm, setLiveCallForm] = useState({
    title: "", type: "custom", label: "LIVE CALL:", labelColor: "#ff3d8b",
    scheduledAt: "", liveUrl: "", liveUrlUnlocksMinutesBefore: "30",
    recordingUrl: "", recordingLabel: "", prerequisiteNote: "",
    facilitatorName: "", facilitatorTitle: "", facilitatorDescription: "",
    stayTunedMessage: "Stay tuned — the link will unlock before the session begins",
    stayTunedColor: "#00c4cc",
  });
  const [deletingLiveCall, setDeletingLiveCall] = useState<string | null>(null);

  const openCreateLiveCall = () => {
    setLiveCallForm({ title: "", type: "custom", label: "LIVE CALL:", labelColor: "#ff3d8b", scheduledAt: "", liveUrl: "", liveUrlUnlocksMinutesBefore: "30", recordingUrl: "", recordingLabel: "", prerequisiteNote: "", facilitatorName: "", facilitatorTitle: "", facilitatorDescription: "", stayTunedMessage: "Stay tuned — the link will unlock before the session begins", stayTunedColor: "#00c4cc" });
    setEditingLiveCall(null); setShowLiveCallForm(true);
  };
  const openEditLiveCall = (lc: any) => {
    setLiveCallForm({ title: lc.title || "", type: lc.type || "custom", label: lc.label || "LIVE CALL:", labelColor: lc.labelColor || "#ff3d8b", scheduledAt: lc.scheduledAt ? new Date(lc.scheduledAt).toISOString().slice(0, 16) : "", liveUrl: lc.liveUrl || "", liveUrlUnlocksMinutesBefore: String(lc.liveUrlUnlocksMinutesBefore ?? 30), recordingUrl: lc.recordingUrl || "", recordingLabel: lc.recordingLabel || "", prerequisiteNote: lc.prerequisiteNote || "", facilitatorName: lc.facilitatorName || "", facilitatorTitle: lc.facilitatorTitle || "", facilitatorDescription: lc.facilitatorDescription || "", stayTunedMessage: lc.stayTunedMessage || "", stayTunedColor: lc.stayTunedColor || "#00c4cc" });
    setEditingLiveCall(lc); setShowLiveCallForm(true);
  };

  const handleSaveLiveCall = async () => {
    if (!liveCallForm.title) return toast.error("Title is required");
    if (!liveCallForm.scheduledAt) return toast.error("Scheduled date is required");
    try {
      const lcData: any = { title: liveCallForm.title, type: liveCallForm.type, label: liveCallForm.label, labelColor: liveCallForm.labelColor, scheduledAt: new Date(liveCallForm.scheduledAt).toISOString(), liveUrl: liveCallForm.liveUrl || null, liveUrlUnlocksMinutesBefore: Number(liveCallForm.liveUrlUnlocksMinutesBefore) || 30, recordingUrl: liveCallForm.recordingUrl || null, recordingLabel: liveCallForm.recordingLabel || null, prerequisiteNote: liveCallForm.prerequisiteNote || null, facilitatorName: liveCallForm.facilitatorName || null, facilitatorTitle: liveCallForm.facilitatorTitle || null, facilitatorDescription: liveCallForm.facilitatorDescription || null, stayTunedMessage: liveCallForm.stayTunedMessage || null, stayTunedColor: liveCallForm.stayTunedColor };
      if (editingLiveCall) { await updateLiveCall.mutateAsync({ id: editingLiveCall.id, data: lcData }); toast.success("Live call updated"); }
      else { await createLiveCall.mutateAsync(lcData); toast.success("Live call created"); }
      setShowLiveCallForm(false); refetchLiveCalls();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteLiveCall = async (lcId: string) => {
    try { await deleteLiveCall.mutateAsync(lcId); toast.success("Live call deleted"); setDeletingLiveCall(null); refetchLiveCalls(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── Assignment state ──────────────────────────────────────────────────
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentChallengeId, setAssignmentChallengeId] = useState<string>("");
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [assignmentForm, setAssignmentForm] = useState({ title: "", questionText: "", typeLabel: "", iconType: "document", order: 1 });
  const [deletingAssignment, setDeletingAssignment] = useState<string | null>(null);
  const [viewingSubmissionsId, setViewingSubmissionsId] = useState<string | null>(null);

  const openCreateAssignment = (challengeId: string) => {
    const group = assignmentGroups.find((g: any) => g.challengeId === challengeId);
    const nextOrder = (group?.assignments?.length || 0) + 1;
    setAssignmentChallengeId(challengeId);
    setAssignmentForm({ title: "", questionText: "", typeLabel: "", iconType: "document", order: nextOrder });
    setEditingAssignment(null);
    setShowAssignmentForm(true);
  };
  const openEditAssignment = (a: any, challengeId: string) => {
    setAssignmentChallengeId(challengeId);
    setAssignmentForm({ title: a.title, questionText: a.questionText || "", typeLabel: a.typeLabel || "", iconType: a.iconType || "document", order: a.order ?? 1 });
    setEditingAssignment(a);
    setShowAssignmentForm(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignmentForm.title) return toast.error("Title is required");
    try {
      if (editingAssignment) { await updateAssignment.mutateAsync({ id: editingAssignment.id, data: { ...assignmentForm, order: assignmentForm.order } }); toast.success("Assignment updated"); }
      else { await createAssignment.mutateAsync({ ...assignmentForm, order: assignmentForm.order, challengeId: assignmentChallengeId }); toast.success("Assignment created"); }
      setShowAssignmentForm(false); refetchAssignments();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteAssignment = async (aId: string) => {
    try { await deleteAssignment.mutateAsync(aId); toast.success("Assignment deleted"); setDeletingAssignment(null); refetchAssignments(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── QA state ──────────────────────────────────────────────────────────
  const [expandedQAPost, setExpandedQAPost] = useState<string | null>(null);
  const [replyingQA, setReplyingQA] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [deletingQAPost, setDeletingQAPost] = useState<string | null>(null);
  const [deletingQAReply, setDeletingQAReply] = useState<string | null>(null);

  const handleReplyQA = async (postId: string) => {
    if (!replyText.trim()) return;
    try { await replyQA.mutateAsync({ postId, replyText }); toast.success("Reply posted"); setReplyingQA(null); setReplyText(""); refetchQA(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteQAPost = async (postId: string) => {
    try { await deleteQAPost.mutateAsync(postId); toast.success("Post deleted"); setDeletingQAPost(null); refetchQA(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteQAReply = async (replyId: string) => {
    try { await deleteQAReply.mutateAsync(replyId); toast.success("Reply deleted"); setDeletingQAReply(null); refetchQA(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── Enrollment state ──────────────────────────────────────────────────
  const [deletingEnrollment, setDeletingEnrollment] = useState<string | null>(null);
  const [enrollSearch, setEnrollSearch] = useState("");
  const [enrollDropOpen, setEnrollDropOpen] = useState(false);
  const [selectedEnrollMembers, setSelectedEnrollMembers] = useState<{ id: string; name: string }[]>([]);
  const { data: enrollSearchData } = useListMembers({ search: enrollSearch, limit: 8 });
  const enrollSearchResults = (enrollSearchData as any)?.data || [];
  const enrolledMemberIds = new Set(enrollments.map((e: any) => e.memberId));

  const toggleEnrollMember = (m: any) => {
    const name = `${m.firstName} ${m.lastName || ""}`.trim();
    if (selectedEnrollMembers.find(s => s.id === m.id)) {
      setSelectedEnrollMembers(prev => prev.filter(s => s.id !== m.id));
    } else {
      setSelectedEnrollMembers(prev => [...prev, { id: m.id, name }]);
    }
  };

  const handleUpdateEnrollment = async (enrollmentId: string, status: string) => {
    try { await updateEnrollment.mutateAsync({ enrollmentId, status }); toast.success("Status updated"); refetchEnrollments(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteEnrollment = async (enrollmentId: string) => {
    try { await deleteEnrollment.mutateAsync(enrollmentId); toast.success("Enrollment removed"); setDeletingEnrollment(null); refetchEnrollments(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleBulkEnroll = async () => {
    if (!selectedEnrollMembers.length) return toast.error("Select at least one member");
    try {
      await enrollMembers.mutateAsync(selectedEnrollMembers.map(m => m.id));
      toast.success(`${selectedEnrollMembers.length} member(s) enrolled`);
      setSelectedEnrollMembers([]);
      setEnrollSearch("");
      refetchEnrollments();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const clearDeleting = () => { setDeletingChallenge(null); setDeletingEpisode(null); setDeletingLiveCall(null); setDeletingAssignment(null); setDeletingQAPost(null); setDeletingQAReply(null); setDeletingFlowItem(null); setDeletingEnrollment(null); };

  if (workshopLoading) return <DashboardLayout><div className="flex items-center justify-center py-40"><Loader2 size={36} className="animate-spin text-[#dc2626]" /></div></DashboardLayout>;
  if (!workshop) return <DashboardLayout><div className="text-center py-40"><AlertCircle size={40} className="mx-auto text-[#333] mb-4" /><p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest">Workshop not found</p><button onClick={() => router.push("/workshops")} className="mt-4 text-[#dc2626] hover:underline text-sm">← Back</button></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => router.push("/workshops")} className="mt-1 text-[#444] hover:text-white transition-colors"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">{workshop.title}</h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">/{workshop.slug} · {workshop.deliveryMode}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#111] border border-[#2a2a2a] rounded-xl p-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-all ${activeTab === tab.id ? "bg-[#dc2626] text-white" : "text-[#606060] hover:text-[#a0a0a0] hover:bg-white/[0.03]"}`}>
                <Icon size={13} />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── INFO & LABELS TAB ───────────────────────────────────────── */}
        {activeTab === "info" && (
          <div className="space-y-6">
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani border-b border-[#2a2a2a] pb-3">Workshop Info</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Title</label><p className="text-[#f0f0f0] text-sm bg-[#141414] border border-[#333] rounded-lg h-11 px-4 flex items-center">{workshop.title}</p></div>
                <div><label className={labelCls}>Slug</label><p className="text-[#f0f0f0] text-sm font-mono bg-[#141414] border border-[#333] rounded-lg h-11 px-4 flex items-center">/{workshop.slug}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Delivery Mode</label><p className="text-[#a0a0a0] text-sm uppercase font-rajdhani font-bold bg-[#141414] border border-[#333] rounded-lg h-11 px-4 flex items-center">{workshop.deliveryMode}</p></div>
                <div><label className={labelCls}>Required Tier</label><p className="text-[#a0a0a0] text-sm font-rajdhani font-bold bg-[#141414] border border-[#333] rounded-lg h-11 px-4 flex items-center">{workshop.requiredTier}</p></div>
                <div><label className={labelCls}>Status</label><p className={`text-sm font-bold uppercase font-rajdhani bg-[#141414] border border-[#333] rounded-lg h-11 px-4 flex items-center ${workshop.isActive ? "text-green-400" : "text-[#606060]"}`}>{workshop.isActive ? "Active" : "Inactive"}</p></div>
              </div>
            </div>

            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani border-b border-[#2a2a2a] pb-3">App Label Config</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "tabChallengesLabel", label: "Challenges Tab Label" },
                  { key: "tabQaLabel", label: "Q&A Tab Label" },
                  { key: "tabAssignmentLabel", label: "Assignment Tab Label" },
                  { key: "progressWidgetLabel", label: "Progress Widget Label" },
                  { key: "workshopFlowLabel", label: "Workshop Flow Label" },
                  { key: "backLabel", label: "Back Button Label" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input value={(labelsForm as any)[key]} onChange={e => setLabelsForm(f => ({ ...f, [key]: e.target.value }))} className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>Milestone Count</label>
                  <input type="number" value={labelsForm.progressMilestoneCount} onChange={e => setLabelsForm(f => ({ ...f, progressMilestoneCount: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Back URL</label>
                  <input value={labelsForm.backUrl} onChange={e => setLabelsForm(f => ({ ...f, backUrl: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={handleSaveLabels} disabled={updateWorkshop.isPending} className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
                  {updateWorkshop.isPending && <Loader2 size={13} className="animate-spin" />} Save Labels
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FLOW BUILDER TAB ─────────────────────────────────────────── */}
        {activeTab === "flow" && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {flowIsDirty && (
                  <button
                    onClick={handleSaveFlowOrder}
                    disabled={reorderFlowItems.isPending}
                    className="flex items-center gap-2 bg-[#222] border border-[#dc2626] text-[#dc2626] px-4 py-2 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-[#dc2626] hover:text-white transition-all"
                  >
                    {reorderFlowItems.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Order
                  </button>
                )}
              </div>
              {/* Add dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAddItemMenu(v => !v)}
                  className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2 rounded-md font-rajdhani font-bold text-[11px] tracking-widest uppercase transition-all"
                >
                  <Plus size={12} /> Add Item <ChevronDown size={12} className={`transition-transform ${showAddItemMenu ? "rotate-180" : ""}`} />
                </button>
                {showAddItemMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAddItemMenu(false)} />
                    <div className="absolute right-0 mt-1.5 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-20 py-1 min-w-[180px]">
                      <button onClick={() => { openCreateFlow("custom"); setShowAddItemMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-amber-400 hover:bg-white/[0.04] transition-all">
                        <FileText size={13} /> Pre-Requisite
                      </button>
                      <button onClick={() => { openCreateFlow("challenge_start"); setShowAddItemMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-purple-400 hover:bg-white/[0.04] transition-all">
                        <BookMarked size={13} /> Challenge
                      </button>
                      <button onClick={() => { openCreateFlow("live_call"); setShowAddItemMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-blue-400 hover:bg-white/[0.04] transition-all">
                        <PhoneCall size={13} /> Live Call
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {localFlowItems.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-16">
                <Workflow size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No flow items yet</p>
                <p className="text-[#444] text-xs mt-2">Add Pre-Requisite, Challenge, or Live Call items above</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                {flowIsDirty && (
                  <div className="px-5 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between">
                    <span className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani animate-pulse">Unsaved order</span>
                  </div>
                )}
                <div className="divide-y divide-[#2a2a2a]">
                  {localFlowItems.map((item: any, i: number) => {
                    const isChallenge = item.type === "challenge_start";
                    const isLiveCall = item.type === "live_call";
                    const isPreReq = item.type === "custom";
                    const typeColor = isChallenge
                      ? "text-purple-400 bg-purple-400/10 border-purple-400/20"
                      : isLiveCall
                      ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
                      : "text-amber-400 bg-amber-400/10 border-amber-400/20";
                    const TypeIcon = isChallenge ? BookMarked : isLiveCall ? PhoneCall : FileText;
                    const typeLabel = isChallenge ? "Challenge" : isLiveCall ? "Live Call" : "Pre-Req";

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => onFlowDragStart(i)}
                        onDragOver={e => onFlowDragOver(e, i)}
                        onDrop={e => onFlowDrop(e, i)}
                        onDragEnd={onFlowDragEnd}
                        className={`flex items-center gap-4 px-5 py-4 group transition-all select-none
                          ${flowDragOver === i ? "bg-[#dc2626]/10 border-t-2 border-[#dc2626]" : "hover:bg-white/[0.02]"}
                          ${flowDragIdx.current === i ? "opacity-40" : "opacity-100"}`}
                      >
                        <GripVertical size={16} className="text-[#444] cursor-grab active:cursor-grabbing group-hover:text-[#666] shrink-0" />
                        <span className="text-[11px] text-[#444] font-mono w-5 shrink-0 text-center">{i + 1}</span>

                        {/* Type icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColor.replace(/text-\S+/, "").replace(/border-\S+/, "")}`}
                          style={{ border: "1px solid" }}>
                          <TypeIcon size={14} className={typeColor.split(" ")[0]} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border font-rajdhani ${typeColor}`}>{typeLabel}</span>
                            <p className="text-sm font-medium text-[#f0f0f0] truncate">{item.label}</p>
                          </div>
                          {isChallenge && item.challenge && (
                            <p className="text-[11px] text-[#555] truncate">
                              {item.challenge.numberLabel || item.challenge.title} · {item.challenge.episodes?.length || 0} episode{(item.challenge.episodes?.length || 0) !== 1 ? "s" : ""}
                            </p>
                          )}
                          {isLiveCall && item.liveCall && (
                            <p className="text-[11px] text-[#555] truncate">{item.liveCall.title}</p>
                          )}
                          {isPreReq && item.description && (
                            <p className="text-[11px] text-[#555] truncate">{item.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => openEditFlow(item)} className="p-1.5 text-[#444] hover:text-green-400 hover:bg-green-400/10 rounded transition-all"><Pencil size={14} /></button>
                          <button onClick={() => setDeletingFlowItem(item.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHALLENGES TAB ──────────────────────────────────────────── */}
        {activeTab === "challenges" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openCreateChallenge} className="flex items-center gap-2 bg-[#dc2626] text-white px-4 py-2 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
                <Plus size={14} /> Add Challenge
              </button>
            </div>
            {challenges.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-16">
                <BookOpen size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No challenges yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {challenges.map((c: any) => (
                  <div key={c.id} className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-rajdhani font-bold text-lg shrink-0"
                        style={{ color: c.numberColor || "#dc2626", backgroundColor: `${c.numberColor || "#dc2626"}18`, border: `1px solid ${c.numberColor || "#dc2626"}35` }}>
                        {c.challengeNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#f0f0f0] text-sm">{c.title}</p>
                        {c.numberLabel && <p className="text-[11px] text-[#444] mt-0.5">{c.numberLabel}</p>}
                        {c.description && <p className="text-[11px] text-[#555] mt-0.5 truncate">{c.description}</p>}
                        <p className="text-[11px] text-[#444] mt-0.5">{c.episodes?.length || 0} episode{(c.episodes?.length || 0) !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => openCreateEpisode(c.id)} className="flex items-center gap-1 px-2.5 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[10px] font-bold text-[#606060] hover:text-white font-rajdhani uppercase tracking-widest transition-all">
                          <Plus size={10} /> Episode
                        </button>
                        <button onClick={() => setExpandedChallenge(expandedChallenge === c.id ? null : c.id)} className="p-1.5 text-[#444] hover:text-white rounded transition-all">
                          <ChevronRight size={16} className={`transition-transform ${expandedChallenge === c.id ? "rotate-90" : ""}`} />
                        </button>
                        <button onClick={() => openEditChallenge(c)} className="p-1.5 text-[#444] hover:text-green-400 rounded transition-all"><Pencil size={14} /></button>
                        <button onClick={() => setDeletingChallenge(c.id)} className="p-1.5 text-[#444] hover:text-red-400 rounded transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {expandedChallenge === c.id && (
                      <div className="border-t border-[#222]">
                        {episodesDirty && (
                          <div className="px-5 py-2 bg-[#1a1a1a] border-b border-[#222] flex items-center justify-between">
                            <span className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani animate-pulse">Unsaved order</span>
                            <button onClick={handleSaveEpisodeOrder} disabled={reorderChallengeEpisodes.isPending} className="flex items-center gap-1.5 bg-[#dc2626] text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest font-rajdhani hover:bg-red-700 transition-all">
                              {reorderChallengeEpisodes.isPending ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save Order
                            </button>
                          </div>
                        )}
                        <div className="divide-y divide-[#1e1e1e]">
                          {localEpisodes.length === 0 && <p className="px-6 py-4 text-[12px] text-[#444] italic">No episodes — click &quot;+ Episode&quot; to add one.</p>}
                          {localEpisodes.map((ep: any, epIdx: number) => (
                            <div
                              key={ep.id}
                              draggable
                              onDragStart={() => onEpDragStart(epIdx)}
                              onDragOver={e => onEpDragOver(e, epIdx)}
                              onDrop={e => onEpDrop(e, epIdx)}
                              onDragEnd={onEpDragEnd}
                              className={`flex items-center gap-3 px-6 py-3 bg-[#141414] transition-colors select-none
                                ${epDragOver === epIdx ? "bg-[#dc2626]/10 border-t-2 border-[#dc2626]" : "hover:bg-[#161616]"}
                                ${epDragIdx.current === epIdx ? "opacity-40" : "opacity-100"}`}
                            >
                              <GripVertical size={14} className="text-[#333] cursor-grab active:cursor-grabbing hover:text-[#555] shrink-0" />
                              <div className="w-5 h-5 rounded bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[10px] text-[#444] font-rajdhani font-bold shrink-0">{epIdx + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[#e0e0e0] truncate">{ep.title}</p>
                                <p className="text-[10px] text-[#444] mt-0.5 uppercase">
                                  {ep.typeLabel || ep.type}
                                  {ep.durationSeconds ? ` · ${Math.floor(ep.durationSeconds / 60)}m ${ep.durationSeconds % 60 > 0 ? `${ep.durationSeconds % 60}s` : ""}`.trim() : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => openEditEpisode(ep, c.id)} className="p-1 text-[#444] hover:text-green-400 rounded transition-all"><Pencil size={12} /></button>
                                <button onClick={() => setDeletingEpisode(ep.id)} className="p-1 text-[#444] hover:text-red-400 rounded transition-all"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LIVE CALLS TAB ──────────────────────────────────────────── */}
        {activeTab === "live-calls" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openCreateLiveCall} className="flex items-center gap-2 bg-[#dc2626] text-white px-4 py-2 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
                <Plus size={14} /> Add Live Call
              </button>
            </div>
            {liveCalls.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-16">
                <Video size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No live calls scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2a2a2a] bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                {liveCalls.map((lc: any) => (
                  <div key={lc.id} className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Video size={16} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest font-rajdhani px-2 py-0.5 rounded" style={{ color: lc.labelColor || "#ff3d8b", backgroundColor: `${lc.labelColor || "#ff3d8b"}18` }}>{lc.label}</span>
                        {lc.type && (
                          <span className="text-[9px] font-bold uppercase tracking-widest font-rajdhani px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#555]">
                            {LIVE_CALL_TYPES.find(t => t.value === lc.type)?.label ?? lc.type}
                          </span>
                        )}
                        <p className="font-bold text-[#f0f0f0] text-sm">{lc.title}</p>
                      </div>
                      {lc.facilitatorName && <p className="text-[12px] text-[#606060] mt-0.5">{lc.facilitatorName}{lc.facilitatorTitle ? ` · ${lc.facilitatorTitle}` : ""}</p>}
                      {lc.scheduledAt && <p className="text-[12px] text-[#606060] mt-0.5">{format(new Date(lc.scheduledAt), "dd MMM yyyy HH:mm")}</p>}
                      {lc.stayTunedMessage && <p className="text-[11px] text-[#444] mt-1 italic">{lc.stayTunedMessage}</p>}
                      <div className="flex gap-3 mt-2">
                        {lc.liveUrl && <a href={lc.liveUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline">Live Link</a>}
                        {lc.recordingUrl && <a href={lc.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-green-400 hover:underline">{lc.recordingLabel || "Recording"}</a>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openEditLiveCall(lc)} className="p-1.5 text-[#444] hover:text-green-400 rounded transition-all"><Pencil size={14} /></button>
                      <button onClick={() => setDeletingLiveCall(lc.id)} className="p-1.5 text-[#444] hover:text-red-400 rounded transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ASSIGNMENTS TAB ─────────────────────────────────────────── */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
            {challenges.length > 0 && (
              <div className="flex justify-end">
                <select onChange={e => { if (e.target.value) openCreateAssignment(e.target.value); e.target.value = ""; }} className="bg-[#dc2626] border-0 text-white px-4 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest cursor-pointer" defaultValue="">
                  <option value="" disabled>+ Add to Challenge...</option>
                  {challenges.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            )}
            {assignmentGroups.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-16">
                <ClipboardList size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No assignments yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignmentGroups.map((group: any) => (
                  <div key={group.challengeId} className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-[#222] bg-[#1a1a1a]">
                      <span className="font-rajdhani font-bold text-[12px] uppercase tracking-widest text-[#a0a0a0]">{group.challengeTitle}</span>
                      <button onClick={() => openCreateAssignment(group.challengeId)} className="flex items-center gap-1 text-[11px] text-[#dc2626] hover:text-red-400 font-rajdhani font-bold uppercase tracking-widest"><Plus size={11} /> Add</button>
                    </div>
                    <div className="divide-y divide-[#1e1e1e]">
                      {group.assignments.map((a: any) => (
                        <div key={a.id}>
                          <div className="flex items-start gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[#f0f0f0] text-sm">{a.title}</p>
                              {a.questionText && <p className="text-[12px] text-[#606060] mt-1">{a.questionText}</p>}
                              <div className="flex items-center gap-3 mt-1">
                                {a.typeLabel && <span className="text-[10px] text-[#444] uppercase font-rajdhani font-bold tracking-widest">{a.typeLabel}</span>}
                                {a._count?.submissions != null && (
                                  <button onClick={() => setViewingSubmissionsId(viewingSubmissionsId === a.id ? null : a.id)} className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-rajdhani font-bold uppercase tracking-widest transition-colors">
                                    <BarChart2 size={11} /> {a._count.submissions} submission{a._count.submissions !== 1 ? "s" : ""}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => openEditAssignment(a, group.challengeId)} className="p-1.5 text-[#444] hover:text-green-400 rounded transition-all"><Pencil size={13} /></button>
                              <button onClick={() => setDeletingAssignment(a.id)} className="p-1.5 text-[#444] hover:text-red-400 rounded transition-all"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          {viewingSubmissionsId === a.id && <SubmissionsList assignmentId={a.id} />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Q&A TAB ─────────────────────────────────────────────────── */}
        {activeTab === "qa" && (
          <div className="space-y-3">
            {qaPosts.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-16">
                <MessageSquare size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No questions posted yet</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 px-5 py-2 border-b border-[#222] bg-[#1a1a1a]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Member</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Question</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Time</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Replies</span>
                  <span />
                </div>
                <div className="divide-y divide-[#1e1e1e]">
                  {qaPosts.map((post: any) => {
                    const isExpanded = expandedQAPost === post.id;
                    return (
                      <div key={post.id}>
                        {/* Row */}
                        <div
                          className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 px-5 py-3 items-center hover:bg-white/[0.02] cursor-pointer transition-colors"
                          onClick={() => { setExpandedQAPost(isExpanded ? null : post.id); setReplyingQA(null); setReplyText(""); }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[10px] font-bold text-[#dc2626] uppercase shrink-0">
                              {post.member?.firstName?.charAt(0) || "?"}
                            </div>
                            <span className="text-[12px] font-bold text-[#e0e0e0] truncate">{post.member?.firstName} {post.member?.lastName}</span>
                          </div>
                          <p className="text-[12px] text-[#a0a0a0] truncate">{post.questionText}</p>
                          <span className="text-[11px] text-[#444] whitespace-nowrap">{post.createdAt ? format(new Date(post.createdAt), "dd MMM HH:mm") : ""}</span>
                          <span className="text-[11px] font-bold text-[#606060] font-rajdhani">{post._count?.replies ?? post.replies?.length ?? 0}</span>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <ChevronRight size={13} className={`text-[#444] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            <button onClick={e => { e.stopPropagation(); setDeletingQAPost(post.id); }} className="p-1 text-[#333] hover:text-red-400 rounded transition-all ml-1"><Trash2 size={13} /></button>
                          </div>
                        </div>
                        {/* Expanded panel */}
                        {isExpanded && (
                          <div className="px-5 pb-4 bg-[#111] border-t border-[#1a1a1a]">
                            <p className="text-[13px] text-[#d0d0d0] leading-relaxed pt-3 pb-3 whitespace-pre-wrap">{post.questionText}</p>
                            {post.replies?.length > 0 && (
                              <div className="space-y-2 ml-3 border-l border-[#2a2a2a] pl-4 mb-3">
                                {post.replies.map((reply: any) => (
                                  <div key={reply.id} className="flex items-start gap-2">
                                    <div className="flex-1 text-[12px]">
                                      <span className="font-bold text-[#dc2626] mr-2">{reply.admin ? `${reply.admin.fullName} (Admin)` : reply.member?.firstName}</span>
                                      <span className="text-[#a0a0a0]">{reply.replyText}</span>
                                      {reply.createdAt && <span className="text-[10px] text-[#444] ml-2">{format(new Date(reply.createdAt), "dd MMM HH:mm")}</span>}
                                    </div>
                                    <button onClick={() => setDeletingQAReply(reply.id)} className="p-1 text-[#333] hover:text-red-400 rounded transition-all shrink-0 mt-0.5"><Trash2 size={11} /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {replyingQA === post.id ? (
                              <div className="flex gap-2">
                                <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg h-9 px-3 text-white text-sm outline-none focus:border-[#dc2626] transition-all" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReplyQA(post.id); } }} />
                                <button onClick={() => handleReplyQA(post.id)} disabled={replyQA.isPending} className="px-4 py-1.5 bg-[#dc2626] text-white rounded-lg text-[12px] font-bold hover:bg-red-700 transition-all">
                                  {replyQA.isPending ? <Loader2 size={14} className="animate-spin" /> : "Reply"}
                                </button>
                                <button onClick={() => { setReplyingQA(null); setReplyText(""); }} className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] text-[#606060] rounded-lg text-[12px] hover:text-white transition-all">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setReplyingQA(post.id)} className="text-[11px] text-[#606060] hover:text-[#dc2626] font-rajdhani font-bold uppercase tracking-widest transition-colors">+ Reply</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Pagination */}
                {qaMeta && qaMeta.total > qaMeta.limit && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-[#222] bg-[#1a1a1a]">
                    <span className="text-[11px] text-[#444]">
                      {((qaPage - 1) * (qaMeta.limit || 20)) + 1}–{Math.min(qaPage * (qaMeta.limit || 20), qaMeta.total)} of {qaMeta.total}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setQaPage(p => Math.max(1, p - 1))} disabled={qaPage <= 1} className="px-3 py-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded text-[11px] text-[#a0a0a0] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">Prev</button>
                      <button onClick={() => setQaPage(p => p + 1)} disabled={qaPage * (qaMeta.limit || 20) >= qaMeta.total} className="px-3 py-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded text-[11px] text-[#a0a0a0] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ENROLLMENTS TAB ─────────────────────────────────────────── */}
        {activeTab === "enrollments" && (
          <div className="space-y-4">
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani">Enroll Members</p>
              {/* Selected chips */}
              {selectedEnrollMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedEnrollMembers.map(m => (
                    <span key={m.id} className="inline-flex items-center gap-1.5 bg-[#dc2626]/10 border border-[#dc2626]/30 text-[#f0f0f0] text-[11px] font-bold px-2.5 py-1 rounded-full">
                      {m.name}
                      <button onClick={() => setSelectedEnrollMembers(prev => prev.filter(s => s.id !== m.id))} className="text-[#dc2626] hover:text-red-300 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              {/* Search + enroll button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                  <input
                    value={enrollSearch}
                    onChange={e => { setEnrollSearch(e.target.value); setEnrollDropOpen(true); }}
                    onFocus={() => setEnrollDropOpen(true)}
                    onBlur={() => setTimeout(() => setEnrollDropOpen(false), 150)}
                    placeholder="Search members by name or email..."
                    className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 pl-9 pr-4 text-white text-[12px] outline-none focus:border-[#dc2626] transition-all"
                  />
                  {enrollDropOpen && enrollSearchResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden">
                      {enrollSearchResults.map((m: any) => {
                        const isSelected = !!selectedEnrollMembers.find(s => s.id === m.id);
                        const isEnrolled = enrolledMemberIds.has(m.id);
                        return (
                          <button
                            key={m.id}
                            onMouseDown={() => { if (!isEnrolled) toggleEnrollMember(m); }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isEnrolled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#1f1f1f]"}`}
                          >
                            <div>
                              <p className="text-[12px] font-bold text-[#f0f0f0]">{m.firstName} {m.lastName}</p>
                              <p className="text-[10px] text-[#606060]">{m.email}</p>
                            </div>
                            {isEnrolled
                              ? <span className="text-[9px] text-green-400 font-rajdhani font-bold uppercase tracking-widest">Enrolled</span>
                              : isSelected
                              ? <CheckCircle2 size={14} className="text-[#dc2626]" />
                              : null
                            }
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button onClick={handleBulkEnroll} disabled={!selectedEnrollMembers.length || enrollMembers.isPending} className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2 rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:bg-red-700 transition-all shrink-0 disabled:opacity-50">
                  {enrollMembers.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Enroll{selectedEnrollMembers.length > 1 ? ` (${selectedEnrollMembers.length})` : ""}
                </button>
              </div>
            </div>
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
              {enrollments.length === 0 ? (
                <div className="text-center py-16">
                  <Users size={32} className="mx-auto text-[#333] mb-3" />
                  <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No enrollments yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                      <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Member</th>
                      <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Enrolled</th>
                      <th className="px-6 py-4 w-[80px]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {enrollments.map((e: any) => (
                      <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-[#f0f0f0] text-sm">{e.member?.firstName} {e.member?.lastName}</p>
                          <p className="text-[11px] text-[#444]">{e.member?.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <select value={e.status} onChange={ev => handleUpdateEnrollment(e.id, ev.target.value)} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded h-8 px-2 text-white text-[11px] outline-none focus:border-[#dc2626] transition-all appearance-none">
                            {["active", "completed", "paused", "dropped"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-[#606060] text-sm">{e.createdAt ? format(new Date(e.createdAt), "dd MMM yyyy") : "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {e.status === "completed" && <span className="flex items-center gap-1 text-[11px] text-green-400 font-bold"><CheckCircle2 size={12} /></span>}
                            {e.status === "active" && <span className="flex items-center gap-1 text-[11px] text-blue-400 font-bold"><Clock size={12} /></span>}
                            <button onClick={() => setDeletingEnrollment(e.id)} className="p-1.5 text-[#444] hover:text-red-400 rounded transition-all"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── FLOW FORM ─────────────────────────────────────────────────── */}
      {showFlowForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">
                  {editingFlowItem ? "Edit" : "Add"}{" "}
                  {flowForm.type === "challenge_start" ? "Challenge" : flowForm.type === "live_call" ? "Live Call" : "Pre-Requisite"}
                </h3>
              </div>
              <button onClick={() => setShowFlowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Pre-Requisite fields */}
              {flowForm.type === "custom" && (
                <>
                  <div>
                    <label className={labelCls}>Label *</label>
                    <input value={flowForm.label} onChange={e => setFlowForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Complete onboarding first" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea value={flowForm.description} onChange={e => setFlowForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional note shown to the member" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
                  </div>
                </>
              )}
              {/* Challenge picker */}
              {flowForm.type === "challenge_start" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani">Challenge *</span>
                      {!editingFlowItem && (
                        <button type="button" onClick={() => setFlowInlineCreate(v => !v)} className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#dc2626] hover:text-red-400 transition-colors">
                          {flowInlineCreate ? "← Select existing" : "+ Create new"}
                        </button>
                      )}
                    </div>
                    {flowInlineCreate ? (
                      <div className="space-y-3 bg-[#0f0f0f] border border-[#333] rounded-lg p-4">
                        <p className="text-[10px] text-purple-400 uppercase font-bold tracking-widest font-rajdhani">New Challenge</p>
                        <input value={flowInlineChallengeData.title} onChange={e => setFlowInlineChallengeData(f => ({ ...f, title: e.target.value }))} placeholder="Challenge title *" className={inputCls} />
                        <input value={flowInlineChallengeData.numberLabel} onChange={e => setFlowInlineChallengeData(f => ({ ...f, numberLabel: e.target.value }))} placeholder="Number label (e.g. Challenge 01)" className={inputCls} />
                        <div className="flex gap-3 items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-3">
                          <input type="color" value={flowInlineChallengeData.numberColor} onChange={e => setFlowInlineChallengeData(f => ({ ...f, numberColor: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                          <span className="text-sm text-[#888] font-mono">{flowInlineChallengeData.numberColor}</span>
                        </div>
                      </div>
                    ) : (
                      <select value={flowForm.challengeId} onChange={e => setFlowForm(f => ({ ...f, challengeId: e.target.value }))} className={selectCls}>
                        <option value="">— Select challenge —</option>
                        {challenges.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.numberLabel || c.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea value={flowForm.description} onChange={e => setFlowForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional note for this step" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
                  </div>
                </>
              )}
              {/* Live Call picker */}
              {flowForm.type === "live_call" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani">Live Call *</span>
                      {!editingFlowItem && (
                        <button type="button" onClick={() => setFlowInlineCreate(v => !v)} className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#dc2626] hover:text-red-400 transition-colors">
                          {flowInlineCreate ? "← Select existing" : "+ Create new"}
                        </button>
                      )}
                    </div>
                    {flowInlineCreate ? (
                      <div className="space-y-3 bg-[#0f0f0f] border border-[#333] rounded-lg p-4">
                        <p className="text-[10px] text-blue-400 uppercase font-bold tracking-widest font-rajdhani">New Live Call</p>
                        <input value={flowInlineLiveCallData.title} onChange={e => setFlowInlineLiveCallData(f => ({ ...f, title: e.target.value }))} placeholder="Title *" className={inputCls} />
                        <input type="datetime-local" value={flowInlineLiveCallData.scheduledAt} onChange={e => setFlowInlineLiveCallData(f => ({ ...f, scheduledAt: e.target.value }))} className={inputCls} />
                        <div className="grid grid-cols-2 gap-3">
                          <input value={flowInlineLiveCallData.label} onChange={e => setFlowInlineLiveCallData(f => ({ ...f, label: e.target.value }))} placeholder="Label (e.g. LIVE CALL:)" className={inputCls} />
                          <div className="flex gap-3 items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-3">
                            <input type="color" value={flowInlineLiveCallData.labelColor} onChange={e => setFlowInlineLiveCallData(f => ({ ...f, labelColor: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                            <span className="text-sm text-[#888] font-mono">{flowInlineLiveCallData.labelColor}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <select value={flowForm.liveCallId} onChange={e => setFlowForm(f => ({ ...f, liveCallId: e.target.value }))} className={selectCls}>
                        <option value="">— Select live call —</option>
                        {liveCalls.map((lc: any) => (
                          <option key={lc.id} value={lc.id}>{lc.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea value={flowForm.description} onChange={e => setFlowForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional note for this step" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowFlowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSaveFlow} disabled={addFlowItem.isPending || updateFlowItem.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(addFlowItem.isPending || updateFlowItem.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHALLENGE FORM ────────────────────────────────────────────── */}
      {showChallengeForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingChallenge ? "Edit Challenge" : "New Challenge"}</h3>
              <button onClick={() => setShowChallengeForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Challenge Number</label>
                  <input
                    type="number" min="1"
                    value={challengeForm.challengeNumber}
                    onChange={e => {
                      const num = Number(e.target.value);
                      setChallengeForm(f => ({
                        ...f,
                        challengeNumber: num,
                        numberLabel: !numberLabelManual ? `Challenge ${String(num).padStart(2, "0")}:` : f.numberLabel,
                      }));
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Title *</label>
                  <input value={challengeForm.title} onChange={e => setChallengeForm(f => ({ ...f, title: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani">Number Label</span>
                  {numberLabelManual && !editingChallenge && (
                    <button
                      type="button"
                      onClick={() => {
                        setNumberLabelManual(false);
                        setChallengeForm(f => ({ ...f, numberLabel: `Challenge ${String(f.challengeNumber).padStart(2, "0")}:` }));
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#606060] hover:text-[#a0a0a0] transition-colors"
                    >
                      ↺ Auto
                    </button>
                  )}
                </div>
                <input
                  value={challengeForm.numberLabel}
                  onChange={e => { setNumberLabelManual(true); setChallengeForm(f => ({ ...f, numberLabel: e.target.value })); }}
                  placeholder="e.g. Challenge 01:"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Number Color</label>
                <div className="flex gap-3 items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-3">
                  <input type="color" value={challengeForm.numberColor} onChange={e => setChallengeForm(f => ({ ...f, numberColor: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-sm text-[#888] font-mono">{challengeForm.numberColor}</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={challengeForm.description}
                  onChange={e => setChallengeForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional description shown to members"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowChallengeForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSaveChallenge} disabled={createChallenge.isPending || updateChallenge.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(createChallenge.isPending || updateChallenge.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EPISODE FORM ──────────────────────────────────────────────── */}
      {showEpisodeForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingEpisode ? "Edit Episode" : "New Episode"}</h3>
              <button onClick={() => setShowEpisodeForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={labelCls}>Title *</label><input value={episodeForm.title} onChange={e => setEpisodeForm(f => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={episodeForm.type} onChange={e => setEpisodeForm(f => ({ ...f, type: e.target.value }))} className={selectCls}>
                    {EPISODE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Duration (sec)</label>
                  <input type="number" value={episodeForm.durationSeconds} onChange={e => setEpisodeForm(f => ({ ...f, durationSeconds: e.target.value }))} className={inputCls} />
                  {episodeForm.durationSeconds && Number(episodeForm.durationSeconds) > 0 && (
                    <p className="text-[10px] text-[#555] mt-1 font-mono">
                      ≈ {Math.floor(Number(episodeForm.durationSeconds) / 60)}m {Number(episodeForm.durationSeconds) % 60 > 0 ? `${Number(episodeForm.durationSeconds) % 60}s` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div><label className={labelCls}>Type Label</label><input value={episodeForm.typeLabel} onChange={e => setEpisodeForm(f => ({ ...f, typeLabel: e.target.value }))} placeholder="e.g. IMPLEMENTATION" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Video URL</label>
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => epVideoInputRef.current?.click()} disabled={epVideoUploading}
                    className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani hover:border-[#dc2626] transition-all disabled:opacity-50">
                    {epVideoUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                    {epVideoUploading
                      ? epUploadProgress > 0 ? `${epUploadProgress}%` : "Preparing..."
                      : "Upload to Bunny"}
                  </button>
                  {episodeForm.videoUrl && episodeForm.videoUrl.includes("iframe.mediadelivery.net") && (
                    <span className="text-[10px] text-green-500 font-rajdhani font-bold uppercase tracking-widest">Bunny Stream</span>
                  )}
                  <input ref={epVideoInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleEpisodeVideoUpload(f); e.target.value = ""; }} />
                </div>
                <input value={episodeForm.videoUrl} onChange={e => setEpisodeForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="Or paste embed URL manually..." className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Lock Icon</label>
                  <select value={episodeForm.lockIconType} onChange={e => setEpisodeForm(f => ({ ...f, lockIconType: e.target.value }))} className={selectCls}>
                    {LOCK_ICON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Completed Icon</label>
                  <select value={episodeForm.completedIconType} onChange={e => setEpisodeForm(f => ({ ...f, completedIconType: e.target.value }))} className={selectCls}>
                    {COMPLETED_ICON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowEpisodeForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSaveEpisode} disabled={createEpisode.isPending || updateEpisode.isPending || epVideoUploading} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-60">
                {(createEpisode.isPending || updateEpisode.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE CALL FORM (full 15 fields) ──────────────────────────── */}
      {showLiveCallForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingLiveCall ? "Edit Live Call" : "New Live Call"}</h3>
              <button onClick={() => setShowLiveCallForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div><label className={labelCls}>Title *</label><input value={liveCallForm.title} onChange={e => setLiveCallForm(f => ({ ...f, title: e.target.value }))} placeholder="Session title" className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={liveCallForm.type} onChange={e => setLiveCallForm(f => ({ ...f, type: e.target.value }))} className={selectCls}>
                    {LIVE_CALL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Scheduled At *</label><input type="datetime-local" value={liveCallForm.scheduledAt} onChange={e => setLiveCallForm(f => ({ ...f, scheduledAt: e.target.value }))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Label Text</label>
                  <input value={liveCallForm.label} onChange={e => setLiveCallForm(f => ({ ...f, label: e.target.value }))} placeholder="LIVE CALL:" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Label Color</label>
                  <div className="flex gap-3 items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-3">
                    <input type="color" value={liveCallForm.labelColor} onChange={e => setLiveCallForm(f => ({ ...f, labelColor: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                    <span className="text-sm text-[#888] font-mono">{liveCallForm.labelColor}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Live URL</label><input value={liveCallForm.liveUrl} onChange={e => setLiveCallForm(f => ({ ...f, liveUrl: e.target.value }))} placeholder="https://meet..." className={inputCls} /></div>
                <div><label className={labelCls}>Unlocks Before (min)</label><input type="number" value={liveCallForm.liveUrlUnlocksMinutesBefore} onChange={e => setLiveCallForm(f => ({ ...f, liveUrlUnlocksMinutesBefore: e.target.value }))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Recording URL</label><input value={liveCallForm.recordingUrl} onChange={e => setLiveCallForm(f => ({ ...f, recordingUrl: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Recording Label</label><input value={liveCallForm.recordingLabel} onChange={e => setLiveCallForm(f => ({ ...f, recordingLabel: e.target.value }))} placeholder="Watch Recording" className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Prerequisite Note</label><input value={liveCallForm.prerequisiteNote} onChange={e => setLiveCallForm(f => ({ ...f, prerequisiteNote: e.target.value }))} placeholder="Complete challenge 3 before joining" className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Facilitator Name</label><input value={liveCallForm.facilitatorName} onChange={e => setLiveCallForm(f => ({ ...f, facilitatorName: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Facilitator Title</label><input value={liveCallForm.facilitatorTitle} onChange={e => setLiveCallForm(f => ({ ...f, facilitatorTitle: e.target.value }))} placeholder="Head of Growth" className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Facilitator Description</label><textarea value={liveCallForm.facilitatorDescription} onChange={e => setLiveCallForm(f => ({ ...f, facilitatorDescription: e.target.value }))} rows={2} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" /></div>
              <div><label className={labelCls}>Stay Tuned Message</label><textarea value={liveCallForm.stayTunedMessage} onChange={e => setLiveCallForm(f => ({ ...f, stayTunedMessage: e.target.value }))} rows={2} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" /></div>
              <div>
                <label className={labelCls}>Stay Tuned Color</label>
                <div className="flex gap-3 items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-3">
                  <input type="color" value={liveCallForm.stayTunedColor} onChange={e => setLiveCallForm(f => ({ ...f, stayTunedColor: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-sm text-[#888] font-mono">{liveCallForm.stayTunedColor}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowLiveCallForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSaveLiveCall} disabled={createLiveCall.isPending || updateLiveCall.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(createLiveCall.isPending || updateLiveCall.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGNMENT FORM ───────────────────────────────────────────── */}
      {showAssignmentForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{editingAssignment ? "Edit Assignment" : "New Assignment"}</h3>
              <button onClick={() => setShowAssignmentForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={labelCls}>Title *</label><input value={assignmentForm.title} onChange={e => setAssignmentForm(f => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Question Text</label><textarea value={assignmentForm.questionText} onChange={e => setAssignmentForm(f => ({ ...f, questionText: e.target.value }))} rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Type Label</label><input value={assignmentForm.typeLabel} onChange={e => setAssignmentForm(f => ({ ...f, typeLabel: e.target.value }))} placeholder="e.g. QUESTION" className={inputCls} /></div>
                <div>
                  <label className={labelCls}>Icon Type</label>
                  <select value={assignmentForm.iconType} onChange={e => setAssignmentForm(f => ({ ...f, iconType: e.target.value }))} className={selectCls}>
                    {ASSIGNMENT_ICON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Order</label><input type="number" min={1} value={assignmentForm.order} onChange={e => setAssignmentForm(f => ({ ...f, order: Number(e.target.value) }))} className={inputCls} /></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowAssignmentForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSaveAssignment} disabled={createAssignment.isPending || updateAssignment.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {(createAssignment.isPending || updateAssignment.isPending) && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHARED DELETE CONFIRMATION ────────────────────────────────── */}
      {(deletingChallenge || deletingEpisode || deletingLiveCall || deletingAssignment || deletingQAPost || deletingQAReply || deletingFlowItem || deletingEnrollment) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Confirm Delete?</h3>
            <p className="text-[#606060] text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={clearDeleting} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
              <button
                onClick={() => {
                  if (deletingChallenge) handleDeleteChallenge(deletingChallenge);
                  if (deletingEpisode) handleDeleteEpisode(deletingEpisode);
                  if (deletingLiveCall) handleDeleteLiveCall(deletingLiveCall);
                  if (deletingAssignment) handleDeleteAssignment(deletingAssignment);
                  if (deletingQAPost) handleDeleteQAPost(deletingQAPost);
                  if (deletingQAReply) handleDeleteQAReply(deletingQAReply);
                  if (deletingFlowItem) handleDeleteFlow(deletingFlowItem);
                  if (deletingEnrollment) handleDeleteEnrollment(deletingEnrollment);
                }}
                className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function SubmissionsList({ assignmentId }: { assignmentId: string }) {
  const { data, isLoading } = useListSubmissions(assignmentId);
  const submissions = (data as any)?.data || [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <div className="px-5 py-4 bg-[#111]"><Loader2 size={16} className="animate-spin text-[#dc2626]" /></div>;
  if (!submissions.length) return <div className="px-5 py-4 bg-[#111] text-[12px] text-[#444] italic">No submissions yet.</div>;

  return (
    <div className="bg-[#111] border-t border-[#1a1a1a]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Member</th>
            <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Submitted At</th>
            <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#444] font-rajdhani">Answer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a1a1a]">
          {submissions.map((s: any) => (
            <>
              <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[10px] text-[#dc2626] font-bold uppercase shrink-0">
                      {s.member?.firstName?.charAt(0) || "?"}
                    </div>
                    <span className="text-[12px] font-bold text-[#e0e0e0]">{s.member?.firstName} {s.member?.lastName}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-[12px] text-[#606060] whitespace-nowrap">
                  {s.submittedAt ? format(new Date(s.submittedAt), "dd MMM yyyy HH:mm") : "—"}
                </td>
                <td className="px-5 py-3">
                  {s.answer || s.fileUrl ? (
                    <button
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-rajdhani font-bold uppercase tracking-widest transition-colors"
                    >
                      {expandedId === s.id ? "Hide" : "View"} <ChevronRight size={11} className={`transition-transform ${expandedId === s.id ? "rotate-90" : ""}`} />
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#444] italic">empty</span>
                  )}
                </td>
              </tr>
              {expandedId === s.id && (
                <tr key={`${s.id}-expand`} className="bg-[#0d0d0d]">
                  <td colSpan={3} className="px-5 py-3">
                    {s.answer && <p className="text-[13px] text-[#c0c0c0] leading-relaxed whitespace-pre-wrap">{s.answer}</p>}
                    {s.fileUrl && (
                      <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-blue-400 hover:underline mt-1">
                        <FileText size={12} /> View attachment
                      </a>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
