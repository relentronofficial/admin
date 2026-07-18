// Base URL injected at build time:
//   flutter run --dart-define=API_BASE_URL=http://localhost:8000
//   flutter build appbundle --dart-define=API_BASE_URL=https://api.tamilbusinesstribe.com
const String kApiBaseUrl =
    String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:8000');

// ── Auth ───────────────────────────────────────────────────────────────────────
const String kAuthLogin = '/api/user-auth/login';
const String kAuthVerifyOtp = '/api/user-auth/verify-otp';
const String kAuthRefresh = '/api/user-auth/refresh';
const String kAuthLogout = '/api/user-auth/logout';
const String kAuthForgotPassword = '/api/user-auth/forgot-password';
const String kAuthResetPassword = '/api/user-auth/reset-password';
const String kAuthSignup = '/api/user-auth/signup';

// ── User / Profile ─────────────────────────────────────────────────────────────
const String kUserMe = '/api/user/me';
const String kUserFcmToken = '/api/user/fcm-token';

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
