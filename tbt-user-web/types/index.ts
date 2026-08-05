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
  durationDisplay?: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  price?: number | null;
  hasAccess?: boolean;
  accessType?: string | null;
  accessExpiresAt?: string | null;
  xpPerEpisode?: number;
  passingScorePercent?: number;
  lessons?: Lesson[];
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
  resumeAtSeconds?: number;
  actualWatchedSecs?: number;
  isCompleted?: boolean;
  hasQuiz?: boolean;
  quizUnlockPercent?: number;
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
  loginBgUrl?: string | null;
  loginBgMobileUrl?: string | null;
  loginBgImages?: string[] | null;
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
  dashboardWelcome?: string;
  dashboardSubtitle?: string;
  statCoursesEnrolled?: string;
  statCompleted?: string;
  statStreak?: string;
  statUpcomingEvents?: string;
  recentlyWatched?: string;
  recentlyWatchedEmpty?: string;
  recentlyWatchedEmptyDesc?: string;
  reflectTitle?: string;
  reflectPromptPrefix?: string;
  reflectPromptSuffix?: string;
  reflectPlaceholder?: string;
  reflectSkipLabel?: string;
  reflectSaveLabel?: string;
  reflectSavedLabel?: string;
  // Batch program
  batchProgramLabel?: string;
  batchNotAssignedMsg?: string;
  batchContactMsg?: string;
  batchNoAssignedCta?: string;
  batchDaysApprovedLabel?: string;
  batchAllDaysLabel?: string;
  batchStatusNotStarted?: string;
  batchStatusInProgress?: string;
  batchStatusPendingReview?: string;
  batchStatusApproved?: string;
  batchStatusNeedsRevision?: string;
  batchStatusApprovedCheck?: string;
  batchApprovedPillLabel?: string;
  batchPendingPillLabel?: string;
  batchNeedsRevisionPillLabel?: string;
  batchInProgressPillLabel?: string;
  batchTodayLabel?: string;
  batchNotAssignedNote?: string;
  batchRevisionLabel?: string;
  batchFutureNote?: string;
  batchPendingNote?: string;
  batchApprovedNote?: string;
  batchOpenResourceLabel?: string;
  batchChecklistLabel?: string;
  batchDoneLabel?: string;
  batchJournalLabel?: string;
  batchJournalPlaceholder?: string;
  batchSaveDraftLabel?: string;
  batchSubmitLabel?: string;
  batchProgressSaved?: string;
  batchProgressSaveError?: string;
  batchSubmitSuccess?: string;
  batchAttendanceLabel?: string;
  batchMarkPresentLabel?: string;
  batchPresentLabel?: string;
  batchAbsentLabel?: string;
  batchBreakLabel?: string;
  batchStreakLabel?: string;
  batchStreakUnit?: string;
  batchCertificateLabel?: string;
  batchCompletedMsg?: string;
  batchAttendanceRateLabel?: string;
  batchRequestBreakLabel?: string;
  batchBreakReasonPlaceholder?: string;
  batchBreakSubmittedMsg?: string;
  batchBreakApprovedLabel?: string;
  batchBreakPendingLabel?: string;
  batchCategoryLabel?: string;
  batchNotMarkedLabel?: string;
  batchExtendedDaysLabel?: string;
  batchBreakStartLabel?: string;
  batchBreakEndLabel?: string;
  batchProofLabel?: string;
  batchAttachProofLabel?: string;
  batchLearningResourceLabel?: string;
  batchDeliverablesLabel?: string;
  batchTextProofPlaceholder?: string;
  batchVideoUrlPlaceholder?: string;
  batchLinkUrlPlaceholder?: string;
  batchSubmittedProofLabel?: string;
  batchViewProofLabel?: string;
}

// ─── Batch Program ───────────────────────────────────────────────────────────

export interface MemberDayProgress {
  id: string;
  batchId: string;
  memberId: string;
  dayNumber: number;
  status: 'not_started' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected';
  isCompleted: boolean;
  journalEntry?: string | null;
  journalFileUrl?: string | null;
  completedTaskIds?: string[] | null;
  taskProofs?: Record<string, string> | null;
  reviewNote?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
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
  bgMobileImageUrl?: string | null;
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
  locked?: boolean;
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
  liveCallId?: string | null;
  labelColor?: string | null;
  scheduledAt?: string | null;
  status?: string | null;
  isUnlocked?: boolean;
  recordingAvailable?: boolean;
  recordingLabel?: string | null;
  prerequisiteNote?: string | null;
  liveUrl?: string | null;
  liveUrlUnlocksMinutesBefore?: number;
  facilitatorName?: string | null;
  facilitatorTitle?: string | null;
  facilitatorDescription?: string | null;
  countdownConfig?: { stayTunedMessage: string; stayTunedColor: string } | null;
  externalMeetingUrl?: string | null;
  externalMeetingProvider?: string | null;
  aiSummary?: string | null;
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
  videosWatchPct?: number;
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
  id?: string;
  backUrl: string;
  backLabel: string;
  title: string;
  thumbnailUrl?: string | null;
  description?: string | null;
  enrollmentStatus: string | null;
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
  answerText?: string | null;
  imageUrl?: string | null;
  fileUrl?: string | null;
  videoId?: string | null;
  videoUrl?: string | null;
  yourAnswerLabel?: string | null;
  backLabel?: string | null;
  completedIcon?: string | null;
}

export interface WorkshopAssignment {
  id: string;
  title: string;
  assignmentType: string;
  questionText?: string | null;
  typeLabel: string;
  canEdit?: boolean;
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
  price?: number | null;
  currency?: string;
  category?: string | null;
  stockStatus?: string;
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
  description?: string | null;
  locked?: boolean;
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
  // Workshop-specific
  workshopSlug?: string;
  workshopTitle?: string;
  // Course-specific
  courseId?: string;
  courseTitle?: string;
  // Common
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
  isCompleted?: boolean;
  updatedAt: number;
}

// ─── Support / Helpdesk ───────────────────────────────────────────────────────

export interface HelpdeskSettings {
  title: string;
  buttonText: string;
  subtitle?: string | null;
  whatsappNumber?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  supportTiming?: string | null;
  address?: string | null;
  bannerImage?: string | null;
}

export interface SupportCategory {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

export interface SupportCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  categoryId?: string | null;
  category?: SupportCategoryRef | null;
}

export type SupportTicketStatus = "new" | "in_progress" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "medium" | "high";
export type SupportPreferredContact = "email" | "whatsapp" | "phone";

export interface SupportReply {
  id: string;
  body: string;
  isFromAdmin: boolean;
  createdAt: string;
  authorName?: string | null;
}

export interface SupportTicket {
  id: string;
  displayNumber?: number | null;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  preferredContact?: SupportPreferredContact | null;
  createdAt: string;
  category?: SupportCategoryRef | null;
  attachmentUrl?: string | null;
  attachmentUrls?: string[];
  adminReply?: string | null;
  adminRepliedAt?: string | null;
  replies?: SupportReply[];
}

// ─── Community ────────────────────────────────────────────────────────────────

export type CommunityFilter = "all" | "following" | "mentors" | "mine";
export type ReportReason = "spam" | "harassment" | "inappropriate" | "misinformation" | "other";

export interface CommunityMemberRef {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePhotoUrl?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface CommentPreview {
  id: string;
  content: string;
  createdAt: string;
  member?: CommunityMemberRef | null;
}

export interface CommunityPost {
  id: string;
  memberId: string;
  content: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  isMentor: boolean;
  isPinned: boolean;
  isLikedByMe: boolean;
  isBookmarkedByMe: boolean;
  isApproved?: boolean;
  createdAt: string;
  member?: CommunityMemberRef | null;
  firstLiker?: CommunityMemberRef | null;
  topComment?: CommentPreview | null;
}

export interface CommunityComment {
  id: string;
  postId: string;
  memberId: string;
  content: string;
  createdAt: string;
  likesCount: number;
  isLikedByMe: boolean;
  parentCommentId?: string | null;
  member?: CommunityMemberRef | null;
}

export interface CommunityRecentPost {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
}

export interface CommunityMemberProfile {
  member: CommunityMemberRef;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  recentPosts: CommunityRecentPost[];
}

// ─── Ebooks ───────────────────────────────────────────────────────────────────

export type EbookReviewStatus = "pending" | "approved" | "rejected";
export type EbookHighlightColor = "yellow" | "green" | "blue" | "pink" | "orange";

export interface EbookCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface EbookCategory {
  id: string;
  name: string;
  slug: string;
  status: string;
  sortOrder: number;
}

export interface EbookBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  backgroundImage?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
}

export interface EbookProgress {
  currentPage: number;
  totalPages: number;
  progressPercentage: number;
  completed: boolean;
  updatedAt: string;
}

export interface EbookBookmark {
  id: string;
  bookId: string;
  pageNumber?: number | null;
  createdAt: string;
}

export interface EbookReviewSummary {
  rating: number;
  reviewText?: string | null;
  status: EbookReviewStatus;
  updatedAt: string;
}

export interface EbookReview {
  id: string;
  memberId: string;
  bookId: string;
  rating: number;
  reviewText?: string | null;
  updatedAt: string;
  authorName?: string | null;
  authorPhotoUrl?: string | null;
}

export interface EbookReadingStreak {
  currentStreak: number;
  longestStreak: number;
  lastReadAt?: string | null;
}

export interface EbookAuthorRef {
  id: string;
  name: string;
  slug: string;
  photoUrl?: string | null;
}

export interface EbookAuthorDetails {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  photoUrl?: string | null;
}

export interface EbookAuthorProfile {
  author: EbookAuthorDetails;
  books: Ebook[];
}

export interface EbookPublisherRef {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

export interface EbookSeriesRef {
  id: string;
  title: string;
  slug: string;
  coverUrl?: string | null;
}

export interface EbookSeriesSibling {
  id: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  seriesNumber?: number | null;
}

export interface EbookHighlightBookRef {
  id: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  author?: string | null;
}

export interface EbookHighlight {
  id: string;
  bookId: string;
  pageNumber: number;
  selectedText: string;
  highlightColor: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  book?: EbookHighlightBookRef | null;
}

export interface Ebook {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  author?: string | null;
  categoryId?: string | null;
  coverImage?: string | null;
  pdfUrl?: string | null;
  contentUrl?: string | null;
  totalPages: number;
  readingTime?: string | null;
  isFeatured: boolean;
  status: string;
  publishDate: string;
  category?: EbookCategoryRef | null;
  progress?: EbookProgress | null;
  bookmark?: EbookBookmark | null;
  locked?: boolean;
  averageRating?: number;
  reviewCount?: number;
  myReview?: EbookReviewSummary | null;
  pinnedAt?: string | null;
  pinnedUntil?: string | null;
  series?: EbookSeriesRef | null;
  seriesNumber?: number | null;
  seriesSiblings?: EbookSeriesSibling[];
  authorRef?: EbookAuthorRef | null;
  isbn?: string | null;
  language?: string | null;
  publisher?: EbookPublisherRef | null;
  viewCount?: number;
}

export interface ContinueReadingItem extends EbookProgress {
  book: Ebook;
}

export interface BookmarkedItem extends EbookBookmark {
  book: Ebook;
}

// ─── Podcasts ─────────────────────────────────────────────────────────────────

export interface PodcastCategory {
  id: string;
  name: string;
  slug: string;
  status: string;
  sortOrder: number;
}

export interface PodcastCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface PodcastSeries {
  id: string;
  title: string;
  slug: string;
  status: string;
  sortOrder: number;
  description?: string | null;
  coverImage?: string | null;
  episodesCount?: number | null;
}

export interface PodcastSeriesRef {
  id: string;
  title: string;
  slug: string;
}

export interface PodcastProgress {
  currentPositionSeconds: number;
  totalDurationSeconds: number;
  completed: boolean;
  updatedAt: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  slug: string;
  audioUrl: string;
  durationSeconds: number;
  tags: string[];
  isFeatured: boolean;
  status: string;
  publishDate: string;
  description?: string | null;
  categoryId?: string | null;
  seriesId?: string | null;
  coverImage?: string | null;
  speaker?: string | null;
  category?: PodcastCategoryRef | null;
  series?: PodcastSeriesRef | null;
  progress?: PodcastProgress | null;
}

export interface ContinueListeningItem extends PodcastProgress {
  episode: PodcastEpisode;
}
