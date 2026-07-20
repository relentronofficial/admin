class AppRoutes {
  // Splash
  static const String splash = '/';

  // Auth
  static const String login = '/login';
  static const String signup = '/signup';
  static const String verify = '/verify';
  static const String forgotPassword = '/forgot-password';

  // Shell tabs
  static const String dashboard = '/dashboard';
  static const String tbt = '/tbt';
  static const String workshops = '/workshops';
  static const String search = '/search';
  static const String notifications = '/notifications';
  static const String messages = '/messages';

  // Outside shell — detail pages
  static const String workshopDetail = '/workshops/:id';
  static const String conversationDetail = '/messages/:conversationId';
  static const String courses = '/courses';
  static const String learning = '/learning';
  static const String learningBadges = '/learning/badges';
  static const String courseDetail = '/learning/:courseId';
  static const String lessonPlayer = '/learning/:courseId/:lessonId';
  static const String batchProgram = '/batch-program';
  static const String batchDay = '/batch-program/:day';
  static const String products = '/Products';
  static const String resources = '/Resources';
  static const String history = '/history';
  static const String profile = '/profile';
  static const String events = '/events';
  static const String eventDetail = '/events/:id';
  static const String programs = '/programs';
  static const String programDetail = '/programs/:id';
  static const String webinars = '/webinars';
  static const String webinarDetail = '/webinars/:id';
  static const String liveCall = '/live/:workshopSlug/:callId';
  static const String webinar = '/live/:webinarId'; // standalone webinar
  static const String workshopEpisode =
      '/workshops/:workshopSlug/episode/:episodeId';
  static const String aiContent = '/ai-content';
  static const String podcasts = '/podcasts';
  static const String podcastSeriesDetail = '/podcasts/series/:id';
  static const String podcastPlayer = '/podcasts/player';

  static String podcastSeriesDetailPath(String id) => '/podcasts/series/$id';

  // E-books
  static const String ebooks = '/ebooks';
  static const String ebookDetail = '/ebooks/:id';
  static const String ebookReader = '/ebooks/:id/read';
  static const String ebookBookmarks = '/ebooks/bookmarks';

  static String ebookDetailPath(String id) => '/ebooks/$id';
  static String ebookReaderPath(String id) => '/ebooks/$id/read';

  // Support
  static const String support = '/support';
  static const String supportContact = '/support/contact';
  static const String supportFeedback = '/support/feedback';
  static const String supportMyTickets = '/support/my-tickets';

  // TBT Gamification
  static const String tbtPoints = '/tbt-points';
  static const String wins = '/wins';

  // Path builders
  static String workshopDetailPath(String id) => '/workshops/$id';
  static String conversationPath(String id) => '/messages/$id';
  static String courseDetailPath(String courseId) => '/learning/$courseId';
  static String lessonPlayerPath(String courseId, String lessonId) =>
      '/learning/$courseId/$lessonId';
  static String batchDayPath(int day) => '/batch-program/$day';
  static String eventDetailPath(String id) => '/events/$id';
  static String programDetailPath(String id) => '/programs/$id';
  static String webinarDetailPath(String id) => '/webinars/$id';
  static String liveCallPath(String workshopSlug, String callId) =>
      '/live/$workshopSlug/$callId';
  static String webinarPath(String webinarId) => '/live/$webinarId';
  static String workshopEpisodePath(String slug, String episodeId) =>
      '/workshops/$slug/episode/$episodeId';
}

class RouteNames {
  static const String splash = 'splash';
  static const String login = 'login';
  static const String signup = 'signup';
  static const String verify = 'verify';
  static const String forgotPassword = 'forgot-password';
  static const String dashboard = 'dashboard';
  static const String tbt = 'tbt';
  static const String workshops = 'workshops';
  static const String search = 'search';
  static const String notifications = 'notifications';
  static const String messages = 'messages';
  static const String workshopDetail = 'workshop-detail';
  static const String conversationDetail = 'conversation-detail';
  static const String courses = 'courses';
  static const String learning = 'learning';
  static const String learningBadges = 'learning-badges';
  static const String courseDetail = 'course-detail';
  static const String lessonPlayer = 'lesson-player';
  static const String batchProgram = 'batch-program';
  static const String batchDay = 'batch-day';
  static const String products = 'products';
  static const String resources = 'resources';
  static const String history = 'history';
  static const String profile = 'profile';
  static const String events = 'events';
  static const String eventDetail = 'event-detail';
  static const String programs = 'programs';
  static const String programDetail = 'program-detail';
  static const String webinars = 'webinars';
  static const String webinarDetail = 'webinar-detail';
  static const String liveCall = 'live-call';
  static const String webinar = 'webinar';
  static const String workshopEpisode = 'workshop-episode';
  static const String aiContent = 'ai-content';
  static const String podcasts = 'podcasts';
  static const String podcastSeriesDetail = 'podcast-series-detail';
  static const String podcastPlayer = 'podcast-player';
  static const String ebooks = 'ebooks';
  static const String ebookDetail = 'ebook-detail';
  static const String ebookReader = 'ebook-reader';
  static const String ebookBookmarks = 'ebook-bookmarks';
  static const String support = 'support';
  static const String supportContact = 'support-contact';
  static const String supportFeedback = 'support-feedback';
  static const String supportMyTickets = 'support-my-tickets';
  static const String tbtPoints = 'tbt-points';
  static const String wins = 'wins';
}
