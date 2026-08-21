// Base URL — defaults to production Cloud Run so shipped APKs work
// without any --dart-define. Override for local dev:
//   flutter run --dart-define=API_BASE_URL=http://localhost:8000
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://tbt-backend-464464507912.asia-south1.run.app',
);

// ── Auth ───────────────────────────────────────────────────────────────────────
const String kAuthLogin = '/api/user-auth/login';
const String kAuthVerifyOtp = '/api/user-auth/verify-otp';
const String kAuthRefresh = '/api/user-auth/refresh';
const String kAuthLogout = '/api/user-auth/logout';
const String kAuthForgotPassword = '/api/user-auth/forgot-password';
const String kAuthResetPassword = '/api/user-auth/set-password';
const String kAuthSignup = '/api/user-auth/signup';

// ── User / Profile ─────────────────────────────────────────────────────────────
const String kUserMe = '/api/user/me';
const String kUserFcmToken = '/api/user/fcm-token';
const String kUserMyConnections = '/api/user/me/connections';
const String kUserMyPosts = '/api/user/me/posts';

// ── Legal (Terms & Conditions / Privacy Policy) ──────────────────────────────
// Fetched via `/api/pub/legal/:slug` — slug is one of `terms` / `privacy`.
const String kPubLegal = '/api/pub/legal';

// ── Public Config ──────────────────────────────────────────────────────────────
const String kConfigSite = '/api/pub/config/site';
const String kConfigNav = '/api/pub/config/nav';
const String kConfigUiStrings = '/api/pub/config/ui-strings';

// ── Content Catalog ────────────────────────────────────────────────────────────
const String kContentSections = '/api/content-sections';
const String kHero = '/api/hero-slides';
const String kUserHomeHero = '/api/user/home/hero';
const String kUserHomeSections = '/api/user/home/sections';

// ── Dashboard ──────────────────────────────────────────────────────────────────
const String kDashboardStats = '/api/user/dashboard/stats';
const String kDashboardContinueLearning = '/api/user/dashboard/continue-learning';
const String kDashboardWatchHistory = '/api/user/dashboard/watch-history';

// ── Workshops ──────────────────────────────────────────────────────────────────
const String kWorkshops = '/api/user/workshops';
// /api/user/workshops/:slug/detail — built at call site
const String kWorkshopEnroll = '/enroll';
const String kWorkshopFlow = '/flow';
const String kWorkshopQaQuestions = '/qa/questions';
const String kWorkshopAssignments = '/assignments';
const String kWorkshopLiveCalls = '/live-calls';
// /api/workshops/:id/live-calls/:callId/token — built at call site

// ── Courses (user-facing — /api/user/*) ───────────────────────────────────────
const String kUserCourses = '/api/user/courses';
const String kUserEnrollments = '/api/user/enrollments';
const String kUserBadges = '/api/user/badges';
const String kUserEpisodes = '/api/user/episodes';
// /api/user/courses/:id — built at call site
// /api/user/courses/:id/request-access — built at call site
// /api/user/courses/:id/leaderboard — built at call site
// /api/user/courses/:id/certificate-eligibility — built at call site
// /api/user/courses/:id/certificate — built at call site
// /api/user/courses/:id/episodes/:epId/quiz — built at call site
// /api/user/enrollments/:courseId/progress — built at call site
// /api/user/enrollments/:courseId/progress/:lessonId — built at call site
// /api/user/episodes/:id/playback — built at call site
// /api/user/episodes/:id/progress — built at call site

// ── Batch Program ──────────────────────────────────────────────────────────────
const String kUserBatch = '/api/user-batch';
const String kUserBatchAttendance = '/api/user-batch/attendance';
const String kUserBatchBreaks = '/api/user-batch/breaks';
// /api/user-batch/:dayNumber — built at call site
// /api/user-batch/:dayNumber/submit — built at call site

// ── Notifications ──────────────────────────────────────────────────────────────
const String kNotifications = '/api/user/notifications';
const String kNotificationsUnreadCount = '/api/user/notifications/unread-count';
const String kNotificationsReadAll = '/api/user/notifications/read-all';
// /api/user/notifications/:id/read — built at call site

// ── Messages / Conversations ───────────────────────────────────────────────────
const String kConversations = '/api/user/conversations';
const String kConversationsUnreadCount = '/api/user/conversations/unread-count';
const String kUserQa = '/api/user/qa'; // /:postId/reply — built at call site
const String kUserAssignments = '/api/user/assignments'; // /:id/submit — built at call site
const String kUserAssignmentsFilePresign = '/api/user/assignments/upload/file-presign';
const String kUserAssignmentsImagePresign = '/api/user/assignments/upload/presign';
// /api/user/conversations/:id/messages — built at call site

// ── Products ───────────────────────────────────────────────────────────────────
const String kProducts = '/api/products';
const String kUserProducts = '/api/user/products';
const String kUserProductsMy = '/api/user/products/my';
// /api/user/products/:id/inquire — built at call site

// ── Resources ──────────────────────────────────────────────────────────────────
const String kResources = '/api/resources';
const String kUserResources = '/api/user/resources';
// /api/user/resources/:id/download — built at call site

// ── Events ─────────────────────────────────────────────────────────────────────
const String kUserEvents = '/api/user/events';
// /api/user/events/:id — built at call site

// ── Webinars (standalone live sessions) ───────────────────────────────────────
const String kUserWebinars = '/api/user/webinars';
// /api/user/webinars/:id — built at call site

// ── Programs ───────────────────────────────────────────────────────────────────
const String kUserPrograms = '/api/user/programs';
// /api/user/programs/:id — built at call site

// ── Search ─────────────────────────────────────────────────────────────────────
const String kSearch = '/api/user/search';

// ── Upload ─────────────────────────────────────────────────────────────────────
const String kUploadPresignedUrl = '/api/upload/presigned-url';
const String kUploadBunnyVideoCreate = '/api/upload/bunny-video-create';

// ── AI Content Buddy ───────────────────────────────────────────────────────────
const String kAiCreate = '/api/ai/content/create';
const String kAiConversations = '/api/ai/conversations';
// /api/ai/conversations/:id — PATCH rename, DELETE — built at call site
// /api/ai/conversations/:id/messages — built at call site
const String kAiSaved = '/api/ai/saved';
// /api/ai/saved/:id — PATCH, DELETE — built at call site

// ── Podcasts ───────────────────────────────────────────────────────────────────
const String kPodcastCategories = '/api/podcasts/categories';
const String kPodcastEpisodes = '/api/podcasts/episodes';
// /api/podcasts/episodes/:id — built at call site
const String kPodcastSeries = '/api/podcasts/series';
// /api/podcasts/series/:id — built at call site
const String kPodcastContinueListening = '/api/podcasts/continue-listening';
const String kPodcastProgress = '/api/podcasts/progress';
const String kPodcastMarkCompleted = '/api/podcasts/mark-completed';

// ── Morning Ritual (Module 8B) ───────────────────────────────────────────────
const String kRitualHabits = '/api/rituals/habits';
const String kRitualButtons = '/api/rituals/buttons';

// ── Community feed (Module 9A) ───────────────────────────────────────────────
const String kCommunityFeed = '/api/community/feed';
// Bases for the per-post / per-member routes; the id is appended at the call
// site, matching how the rest of this file handles parameterised paths.
const String kCommunityPosts = '/api/community/posts';
const String kCommunityMembers = '/api/community/members';
const String kCommunityBookmarks = '/api/community/bookmarks';

// ── TBT Gamification ─────────────────────────────────────────────────────────
const String kTbtPath = '/api/tbt/path';
const String kTbtLevels = '/api/tbt/levels';
const String kTbtLeaderboard = '/api/tbt/leaderboard';
// /api/tbt/tasks/:id/complete — built at call site

// ── Support / Helpdesk ────────────────────────────────────────────────────────
const String kHelpdeskSettings = '/api/helpdesk/settings';
const String kHelpdeskCategories = '/api/helpdesk/categories';
const String kHelpdeskFaqs = '/api/helpdesk/faqs';
const String kHelpdeskTickets = '/api/helpdesk/tickets';
const String kHelpdeskMyTickets = '/api/helpdesk/tickets/mine';
const String kHelpdeskFeedback = '/api/helpdesk/feedback';

// ── E-books ────────────────────────────────────────────────────────────────────
const String kEbookCategories = '/api/ebooks/categories';
const String kEbookFeatured = '/api/ebooks/featured';
const String kEbookBanners = '/api/ebooks/banners';
const String kEbookLibrary = '/api/ebooks/library';
// /api/ebooks/books/:id — built at call site
const String kEbookBookmarks = '/api/ebooks/bookmarks';
// /api/ebooks/bookmarks/:bookId — built at call site
const String kEbookProgress = '/api/ebooks/progress';
// /api/ebooks/progress/:bookId — built at call site
const String kEbookContinueReading = '/api/ebooks/continue-reading';

// ── Chat groups (WhatsApp-inspired) ────────────────────────────────
const String kChatGroupsMine = '/api/chat-groups/mine';
const String kChatGroupsStarred = '/api/chat-groups/starred';
// /api/chat-groups/:id — built at call site
// /api/chat-groups/:id/messages — built at call site
// /api/chat-groups/:id/messages/:messageId — edit/delete
// /api/chat-groups/:id/messages/:messageId/react — toggle reaction
// /api/chat-groups/:id/messages/:messageId/forward — POST { toGroupIds }
// /api/chat-groups/:id/messages/:messageId/star — POST/DELETE
// /api/chat-groups/:id/mute — POST { until }
// /api/chat-groups/:id/pinned — GET
// /api/chat-groups/:id/read — POST { messageId }
// /api/chat-groups/:id/search — GET ?q=
// /api/chat-groups/:id/presence — GET
// /api/chat-groups/:id/leave — POST

// ── Advertisements (TBT_ADS_SPECKIT.md §10) ──────────────────────────────────
// Client scope only. These are optional-auth: they work signed-in (JWT cookie
// header) and as a guest, which is why they do not sit behind /api/user*.
const String kAdsEligible = '/api/ads/eligible';
const String kAdsImpression = '/api/ads/impression';
const String kAdsEvents = '/api/ads/events';
const String kAdsComplete = '/api/ads/complete';
const String kAdsSkip = '/api/ads/skip';
const String kAdsClose = '/api/ads/close';
const String kAdsClick = '/api/ads/click';

// ── Self-onboarding (SELF_ONBOARDING_SPECKIT.md §10.5) ──────────────────────
const String kOnboarding = '/api/onboarding';
const String kOnboardingContent = '/api/onboarding/content';
const String kOnboardingPhotoPresign = '/api/onboarding/photo/presign';
const String kOnboardingDocumentsPresign = '/api/onboarding/documents/presign';
const String kOnboardingDocuments = '/api/onboarding/documents';
// /api/onboarding/documents/:id — built at call site
const String kOnboardingSubmit = '/api/onboarding/submit';

// ── Onboarding live meetings (ONBOARDING_LIVE_MEETING_SPECKIT.md) ───────────
const String kOnboardingMeetings = '/api/onboarding-meetings';
// /api/onboarding-meetings/:id/token — built at call site
// /api/onboarding-meetings/:id/leave — built at call site
