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
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

// ─── Site Config ─────────────────────────────────────────────────────────────

export interface SiteTheme {
  accentColor: string;
  alertColor: string;
  successColor: string;
  bgPrimary: string;
  bgSurface: string;
}

/** Shape returned by GET /api/pub/config/site — matches EiFlix_PRD_Dynamic.md §2 */
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
  resourcesDownloadLabel: string;
  paginationPrevLabel: string;
  paginationNextLabel: string;
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

export interface ContinueLearningItem {
  courseId: string;
  title: string;
  thumbnailUrl?: string | null;
  progressPercent: number;
  lastLessonId?: string | null;
  lastLessonTitle?: string | null;
}
