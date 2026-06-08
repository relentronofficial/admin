// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

// ─── User / Member ────────────────────────────────────────────────────────────

export type MemberStatus = "active" | "inactive" | "paused" | "suspended";
export type VerificationStatus = "awaiting_kyc" | "under_review" | "verified" | "rejected";
export type MembershipPlan = "free" | "starter" | "premium" | "vip" | "enterprise";

export interface Member {
  id: string;
  memberId: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone: string;
  profilePhotoUrl?: string | null;
  city?: string | null;
  state?: string | null;
  businessName?: string | null;
  membershipPlan: MembershipPlan;
  status: MemberStatus;
  verificationStatus: VerificationStatus;
  totalPoints: number;
  currentStreak: number;
  healthScore: number;
  onboardingCompleted: boolean;
  createdAt: string;
  accountManager?: {
    id: string;
    fullName: string;
    email: string;
    designation?: string | null;
    profilePhotoUrl?: string | null;
  } | null;
}

// ─── Course / Learning ────────────────────────────────────────────────────────

export type CourseLevel = "beginner" | "intermediate" | "advanced";

export interface Course {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  level: CourseLevel;
  durationHours?: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  instructor?: {
    id: string;
    fullName: string;
    profilePhotoUrl?: string | null;
    designation?: string | null;
  } | null;
  _count?: {
    lessons: number;
    enrollments: number;
  };
}

export interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  duration?: number | null;
  durationSeconds?: number | null;
  order: number;
  isFree: boolean;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  memberId: string;
  enrolledAt: string;
  completedAt?: string | null;
  progressPercent: number;
  course: Course;
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  watchedSeconds?: number;
  completedAt?: string | null;
}

// ─── Event ────────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  eventDate: string;
  location?: string | null;
  isOnline: boolean;
  registrationUrl?: string | null;
  maxAttendees?: number | null;
  status: string;
  createdAt: string;
}

// ─── Webinar ──────────────────────────────────────────────────────────────────

export interface Webinar {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  scheduledAt: string;
  durationMinutes?: number | null;
  status: string;
  streamUrl?: string | null;
  recordingUrl?: string | null;
  host?: {
    id: string;
    fullName: string;
    profilePhotoUrl?: string | null;
    designation?: string | null;
  } | null;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  iconType?: string;
  actionUrl?: string | null;
  mediaType?: "image" | "video" | null;
  mediaUrl?: string | null;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown> | null;
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  subject: string;
  body: string;
  senderName: string;
  senderAvatarUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

// ─── Site Config ─────────────────────────────────────────────────────────────

export interface SiteTheme {
  accentColor: string;
  alertColor: string;
  successColor: string;
  bgPrimary: string;
  bgSurface: string;
}

/** Shape returned by GET /api/pub/config/site — matches TBT_PRD_Dynamic.md §2 */
export interface SiteConfig {
  siteName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  footerText: string;
  theme: SiteTheme;
  splashLogoUrl?: string | null;
  splashDurationMs: number;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  order: number;
  isVisible: boolean;
}

export interface UiStrings {
  loading: string;
  noWorkshops: string;
  noResources: string;
  qaLoadingLabel: string;
  errorGeneric: string;
  lockedContentMessage: string;
  countdownDays: string;
  countdownHours: string;
  countdownMins: string;
  countdownSecs: string;
  profilePersonalLabel: string;
  profileSubscriptionLabel: string;
  profileTiersLabel: string;
  profileSignOutLabel: string;
  profileSaveLabel: string;
  profileFirstNameLabel: string;
  profileLastNameLabel: string;
  profileEmailLabel: string;
  profilePhoneLabel: string;
  profileDobLabel: string;
  profileSubStartLabel: string;
  profileSubEndLabel: string;
  episodeCompleteLabel: string;
  playerAutoLabel: string;
  liveCallJoinLabel: string;
  watchBackLabel: string;
  assignmentCtaLabel: string;
  assignmentSubmitLabel: string;
  assignmentCancelLabel: string;
  notificationsPageTitle: string;
  notificationsUnreadSuffix: string;
  notificationsMarkAllLabel: string;
  notificationsEmptyTitle: string;
  notificationsEmptyDesc: string;
  messagesPageTitle: string;
  messagesUnreadSuffix: string;
  messagesMarkAllLabel: string;
  messagesEmptyTitle: string;
  messagesEmptyDesc: string;
  chatPageTitle: string;
  chatNewLabel: string;
  chatSubjectLabel: string;
  chatTypingText: string;
  chatClosedLabel: string;
  chatEmptyTitle: string;
  chatEmptyDesc: string;
  chatSelectPrompt: string;
  resourcesDownloadLabel: string;
  paginationPrevLabel: string;
  paginationNextLabel: string;
  continueWatchingLabel?: string;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface ProfileBadge {
  id: string;
  label: string;
  color: string;
  bgColor: string;
}

export interface ProfileTier {
  tierNumber: number;
  label: string;
  status: 'unlocked' | 'locked';
  unlockConditionText: string | null;
}

export interface ProfileSection {
  id: string;
  label: string;
  fields: string[];
  fieldLabels: Record<string, string>;
}

export interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string;
  dob: string | null;
  avatarUrl: string | null;
  avatarGradient: string | null;
  currentTier: number;
  membershipPlan: string;
  city: string | null;
  state: string | null;
  businessName: string | null;
  totalPoints: number;
  currentStreak: number;
  healthScore: number;
  notificationPrefs: { email: boolean; push: boolean; sms: boolean } | null;
  badges: ProfileBadge[];
  subscription: {
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  tiers: ProfileTier[];
  sections: ProfileSection[];
  saveLabel: string;
  signOutLabel: string;
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export interface HeroSlide {
  id: string;
  order: number;
  title: string;
  description?: string | null;
  bgVideoUrl?: string | null;
  bgImageUrl?: string | null;
  bgMuteDefault: boolean;
  ctaLabel: string;
  ctaUrl: string;
  ctaType: 'internal' | 'external';
  badgeText?: string | null;
  isActive: boolean;
}

export interface ContentEpisode {
  id: string;
  order: number;
  title: string;
  thumbnailUrl?: string | null;
  durationSeconds: number;
}

export interface ContentItem {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  requiredTier: number;
  isLocked: boolean;
  lockBadgeText?: string | null;
  contentType: string;
  categoryTag?: string | null;
  playUrl?: string | null;
  courseId?: string | null;
  workshopId?: string | null;
  episodeCount?: number | null;
  episodes?: ContentEpisode[];
}

export interface ContentSection {
  id: string;
  title: string;
  slug: string;
  order: number;
  isVisible: boolean;
  requiredTier: number;
  isLocked: boolean;
  lockLabel?: string | null;
  items: ContentItem[];
}

// ─── Workshops (user-facing) ──────────────────────────────────────────────────

export interface WorkshopListItem {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  slug: string;
  enrollmentStatus: string;
  enrolledBadge?: { label: string; color: string } | null;
  completedBadgeIconType?: string | null;
  deliveryMode: string;
  deliveryModeLabel: string;
}

export interface WorkshopSection {
  id: string;
  label: string;
  items: WorkshopListItem[];
}

export interface WorkshopFlowEpisode {
  id: string;
  order: number;
  title: string;
  type: string;
  typeLabel: string;
  durationSeconds?: number | null;
  durationLabel?: string | null;
  isCompleted: boolean;
  isLocked: boolean;
  lockIconType?: string;
  completedIconType?: string;
}

export interface WorkshopFlowItem {
  id: string;
  order: number;
  type: string;
  label?: string | null;
  description?: string | null;
  isCompleted?: boolean;
  isExpanded?: boolean;
  // challenge fields
  challengeNumber?: number | null;
  numberLabel?: string | null;
  numberColor?: string | null;
  title?: string | null;
  progressPercent?: number;
  episodes?: WorkshopFlowEpisode[];
  // live call fields
  labelColor?: string | null;
  scheduledAt?: string | null;
  status?: string | null;
  recordingAvailable?: boolean;
  recordingLabel?: string | null;
  prerequisiteNote?: string | null;
  liveUrl?: string | null;
  liveUrlUnlocksMinutesBefore?: number;
  facilitatorName?: string | null;
  facilitatorTitle?: string | null;
  facilitatorDescription?: string | null;
  countdownConfig?: { stayTunedMessage: string; stayTunedColor: string } | null;
}

// ─── Workshop Detail ──────────────────────────────────────────────────────────

export interface WorkshopTab {
  id: string;
  label: string;
  order: number;
}

export interface LearningProgress {
  label: string;
  percentage: number;
  completedCount: number;
  totalCount: number;
  completedLabel?: string | null;
  milestones?: { achieved: boolean }[];
}

export interface WorkshopCertificate {
  eligible: boolean;
  videosCompletedPct: number;
  challengesCompletedPct: number;
  remainingVideos: number;
  remainingChallenges: number;
}

export interface CertificateDetails {
  certificateId: string;
  memberName: string;
  workshopTitle: string;
  completedAt: string;
  issuedAt: string;
}

export interface WorkshopDetail {
  backUrl: string;
  backLabel: string;
  title: string;
  sidebar: {
    tabs: WorkshopTab[];
  };
  learningProgress: LearningProgress | null;
  certificate: WorkshopCertificate | null;
  workshopFlowLabel?: string | null;
  defaultMainAreaType?: string | null;
}

// ─── Q&A ──────────────────────────────────────────────────────────────────────

export interface QAReply {
  id: string;
  author: { name: string; avatarUrl?: string | null };
  replyText: string;
  timeAgo: string;
}

export interface QAPost {
  id: string;
  author: { name: string; avatarUrl?: string | null };
  questionText: string;
  timeAgo: string;
  replyLabel?: string | null;
  replies: QAReply[];
}

export interface QAResponse {
  heading?: string | null;
  headingHighlight?: string | null;
  communityHeading?: string | null;
  communityHeadingHighlight?: string | null;
  promptText?: string | null;
  inputPlaceholder?: string | null;
  submitLabel: string;
  posts: QAPost[];
  pagination: { total: number; page: number; limit: number };
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export interface AssignmentSubmissionData {
  isSubmitted: boolean;
  answerText: string;
  yourAnswerLabel?: string | null;
  backLabel?: string | null;
  completedIcon?: string | null;
}

export interface WorkshopAssignment {
  id: string;
  title: string;
  typeLabel: string;
  ctaLabel: string;
  submitLabel: string;
  cancelLabel: string;
  submission?: AssignmentSubmissionData | null;
}

export interface AssignmentGroup {
  challengeLabel: string;
  challengeTitle?: string | null;
  assignments: WorkshopAssignment[];
}

export interface AssignmentsResponse {
  groups: AssignmentGroup[];
}

// ─── Products & Resources ─────────────────────────────────────────────────────

export interface ProductCta {
  label: string;
  url: string;
  type: string;
  openInNewTab: boolean;
}

export interface Product {
  id: string;
  order: number;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  isVisible: boolean;
  ctas: ProductCta[];
}

export interface Resource {
  id: string;
  title: string;
  author?: string | null;
  date?: string | null;
  fileUrl: string;
  previewUrl?: string | null;
  fileType: string;
  fileTypeIconUrl?: string | null;
  fileCount: number;
  order: number;
  hoverActions: { type: string; iconType: string; label: string }[];
}

// ─── Episode Playback ─────────────────────────────────────────────────────────

export interface EpisodePlayback {
  id: string;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  videoType: string;
  durationSeconds?: number | null;
  resumeAtSeconds: number;
  qualityOptions: string[];
  defaultQuality: string;
  speedOptions: string[];
  defaultSpeed: string;
  playerLabels: {
    completeLabel: string;
    backLabel: string;
    autoLabel: string;
    fullscreenLabel: string;
  };
}

// ─── Device Tracking ──────────────────────────────────────────────────────────

export interface DeviceSession {
  id: string;
  deviceId: string | null;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  ipAddress: string | null;
  lastActiveAt: string;
  startedAt: string;
  isCurrent: boolean;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalPoints: number;
  currentStreak: number;
  upcomingEvents: number;
  unreadNotifications: number;
}

export interface WatchHistoryItem {
  type: "workshop" | "course";
  episodeId: string;
  workshopSlug: string;
  workshopTitle: string;
  episodeTitle: string;
  challengeTitle: string | null;
  episodeOrder: number;
  episodeCount: number;
  thumbnailUrl: string | null;
  lastWatchedSecs: number;
  actualWatchedSecs: number;
  durationSeconds: number;
  isCompleted: boolean;
  completedAt: string | null;
  updatedAt: string;
  progressPercent: number;
}

export interface ContinueLearningItem {
  type: "course" | "workshop";
  id: string;
  lessonId: string;
  title: string;
  thumbnailUrl?: string | null;
  lastLessonTitle?: string | null;
  challengeTitle?: string | null;
  lastWatchedSecs: number;
  durationSeconds: number | null;
  remainingSecs: number;
  episodeOrder: number;
  episodeCount: number;
  progressPercent: number;
  updatedAt: number;
}
