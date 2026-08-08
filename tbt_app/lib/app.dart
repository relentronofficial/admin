import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/constants/routes.dart';
import 'core/constants/storage_keys.dart';
import 'features/ads/presentation/ad_host.dart';
import 'features/ads/providers/ad_campaign_provider.dart';
import 'features/auth/domain/auth_state.dart';
import 'features/notifications/data/fcm_service.dart';
import 'shared/api/session_state.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/auth/presentation/signup_screen.dart';
import 'features/auth/presentation/otp_screen.dart';
import 'features/auth/presentation/video_splash_screen.dart';
import 'features/auth/presentation/forgot_password_screen.dart';
import 'features/auth/providers/auth_provider.dart';
import 'shared/api/services/auth_service.dart';
import 'features/batch_program/presentation/batch_day_screen.dart';
import 'features/batch_program/presentation/batch_program_screen.dart';
import 'features/courses/presentation/badges_screen.dart';
import 'features/courses/presentation/course_detail_screen.dart';
import 'features/courses/presentation/courses_screen.dart';
import 'features/courses/presentation/learning_overview_screen.dart';
import 'features/courses/presentation/lesson_player_screen.dart';
import 'features/dashboard/presentation/dashboard_screen.dart';
import 'features/events/presentation/event_detail_screen.dart';
import 'features/events/presentation/events_screen.dart';
import 'features/webinars/presentation/webinar_detail_screen.dart';
import 'features/webinars/presentation/webinars_screen.dart';
import 'features/history/presentation/history_screen.dart';
import 'features/live/presentation/live_call_screen.dart';
import 'features/live/presentation/webinar_screen.dart';
import 'features/messages/presentation/conversation_screen.dart';
import 'features/messages/presentation/messages_screen.dart';
import 'features/notifications/presentation/notifications_screen.dart';
import 'features/products/presentation/products_screen.dart';
import 'features/profile/presentation/profile_screen.dart';
import 'features/profile/presentation/connections_screen.dart';
import 'features/profile/presentation/legal_page_screen.dart';
import 'features/resources/presentation/resources_screen.dart';
import 'features/search/presentation/search_screen.dart';
import 'features/tbt/presentation/catalog_screen.dart';
import 'features/workshops/presentation/workshop_detail_screen.dart';
import 'features/workshops/presentation/workshop_episode_player_screen.dart';
import 'features/workshops/presentation/workshops_screen.dart';
import 'features/ai_content/presentation/ai_content_screen.dart';
import 'features/community/presentation/community_screen.dart';
import 'features/community/presentation/saved_posts_screen.dart';
import 'features/podcasts/presentation/podcasts_screen.dart';
import 'features/podcasts/presentation/podcast_series_screen.dart';
import 'features/podcasts/presentation/podcast_player_screen.dart';
import 'features/podcasts/presentation/podcast_mini_player.dart';
import 'features/ebooks/presentation/ebooks_screen.dart';
import 'features/ebooks/presentation/ebook_detail_screen.dart';
import 'features/ebooks/presentation/ebook_reader_screen.dart';
import 'features/ebooks/presentation/ebook_bookmarks_screen.dart';
import 'features/support/presentation/support_screen.dart';
import 'features/support/presentation/support_contact_screen.dart';
import 'features/support/presentation/support_feedback_screen.dart';
import 'features/support/presentation/support_my_tickets_screen.dart';
import 'features/support/presentation/support_ticket_detail_screen.dart';
import 'features/gamification/presentation/tbt_points_screen.dart';
import 'features/gamification/presentation/wins_screen.dart';
import 'features/batch_program/providers/batch_provider.dart';
import 'features/courses/providers/courses_provider.dart';
import 'features/workshops/providers/workshops_provider.dart';
import 'shared/providers/site_config_provider.dart';
import 'shared/providers/socket_provider.dart';
import 'shared/providers/theme_mode_provider.dart';
import 'shared/theme/app_scroll_behavior.dart';
import 'shared/theme/app_theme.dart';
import 'shared/theme/tbt_theme.dart';
import 'shared/widgets/app_navbar.dart';
import 'shared/widgets/bottom_tab_bar.dart';
import 'shared/widgets/offline_banner.dart';
import 'shared/widgets/side_nav_rail.dart';
import 'shared/widgets/subscription_gate.dart';
import 'shared/widgets/tbt_app_drawer.dart';

part 'app.g.dart';

// ── Route guards ───────────────────────────────────────────────────────────────

const _publicPaths = {
  AppRoutes.splash,
  AppRoutes.login,
  AppRoutes.signup,
  AppRoutes.verify,
  AppRoutes.forgotPassword,
};

/// Notifies GoRouter whenever auth state changes so redirect re-evaluates.
class _RouterNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}

@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final notifier = _RouterNotifier();

  ref.listen<AsyncValue<AuthState>>(authNotifierProvider, (_, __) {
    notifier.notify();
  });

  // Historically this listener cleared tokens + flipped AuthNotifier
  // to idle whenever sessionState turned `revoked`. That auto-clear
  // path was the source of "session expired suddenly" reports — an
  // Upstash blip or 401 from /refresh would take the whole session
  // down. Auto-revocation was removed everywhere in the pipeline;
  // the enum value stays reserved for a future admin-forced kill.
  //
  // What's left is a pure UI signal — just re-notify the router so
  // it re-evaluates guards on state change. Tokens are NEVER cleared
  // here anymore; the only paths that clear tokens are the explicit
  // user-triggered `logout()` in AuthService.
  ref.listen<SessionState>(sessionStateProvider, (_, __) {
    notifier.notify();
  });

  // GoRouter handles incoming deep links from the OS automatically (both HTTPS
  // Universal Links and tbt:// custom-scheme URLs) by matching the path against
  // the route table defined in _buildRoutes(). The auth redirect guard runs on
  // every navigation, so unauthenticated deep links land on login and are
  // replayed after sign-in via the ?redirect= query parameter.
  //
  // Terminated-state notification deep links are handled separately in
  // TbtApp._TbtAppState via SharedPreferences (kPrefPendingDeepLink) — see
  // CC-52 implementation in this file.
  //
  // TODO(backend): iOS Universal Links require the backend to serve
  // /.well-known/apple-app-site-association at app.tamilbusinesstribe.com.
  // Android App Links require /.well-known/assetlinks.json at the same host.
  final router = GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: kDebugMode,
    refreshListenable: notifier,
    redirect: (context, state) {
      final authAsync = ref.read(authNotifierProvider);

      // Don't redirect while the auth state is still loading.
      if (authAsync.isLoading) return null;

      final isAuth =
          authAsync.valueOrNull?.step == AuthStep.authenticated;
      final path = state.uri.path;
      final isPublic = _publicPaths.contains(path);

      // Guard 0 — REMOVED. Previously auto-routed to /login when
      // sessionState was revoked. Auto-revocation was removed
      // upstream to fix "session expired suddenly" reports, so this
      // guard could never legitimately fire anymore and became a
      // footgun (any accidental future flip would still boot the
      // user). Only Guards 1 & 2 remain: idle → /login, authed on
      // /login → dashboard. Manual logout goes through /logout →
      // idle → Guard 1.

      // Guard 1 — unauthenticated + non-public route → login
      if (!isAuth && !isPublic) {
        final encoded = Uri.encodeComponent(state.uri.toString());
        return '${AppRoutes.login}?redirect=$encoded';
      }

      // Guard 2 + post-login — authenticated + public route
      if (isAuth && isPublic) {
        final redirectTo = state.uri.queryParameters['redirect'];
        if (redirectTo != null && redirectTo.isNotEmpty) {
          return Uri.decodeComponent(redirectTo);
        }
        // On login/signup/verify without a redirect param → dashboard
        if (path == AppRoutes.login ||
            path == AppRoutes.signup ||
            path == AppRoutes.verify) {
          return AppRoutes.dashboard;
        }
      }

      return null;
    },
    routes: _buildRoutes(),
  );

  ref.onDispose(router.dispose);
  ref.onDispose(notifier.dispose);

  return router;
}

List<RouteBase> _buildRoutes() => [
      // ── Splash ────────────────────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.splash,
        name: RouteNames.splash,
        builder: (_, __) => const VideoSplashScreen(),
      ),

      // ── Auth ──────────────────────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.login,
        name: RouteNames.login,
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.signup,
        name: RouteNames.signup,
        builder: (_, __) => const SignupScreen(),
      ),
      GoRoute(
        path: AppRoutes.verify,
        name: RouteNames.verify,
        builder: (_, state) => OtpScreen(
          phone: state.uri.queryParameters['phone'] ?? '',
          redirect: state.uri.queryParameters['redirect'],
          prefillOtp: state.uri.queryParameters['otp'],
        ),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: RouteNames.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),

      // ── Persistent bottom-nav shell (StatefulShellRoute) ───────────────────
      // Each branch owns its own Navigator stack — tab switches don't
      // erase the previous tab's history, and system back on a non-home
      // tab returns to Home before exiting the app instead of quitting
      // outright (the old ShellRoute + `context.go` combo replaced the
      // stack on every tab tap, causing the "back closes app" bug).
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => _AppShell(
          navigationShell: navigationShell,
          // AdHost wraps the shell body (TBT_ADS_SPECKIT.md §10) — the overlay
          // then covers the bottom nav and mini-player while every branch keeps
          // its navigation stack. It sits INSIDE SubscriptionGate so a gated
          // member never sees an ad stacked on the gate.
          child: Column(
            children: [
              const OfflineBanner(),
              Expanded(
                child: SubscriptionGate(child: AdHost(child: navigationShell)),
              ),
            ],
          ),
        ),
        branches: [
          // Branch 0 — HOME. Root /dashboard; sub-routes are secondary
          // pages that share the bottom bar (TBT catalog, workshops list,
          // search, notifications, messages).
          StatefulShellBranch(routes: [
            GoRoute(
              path: AppRoutes.dashboard,
              name: RouteNames.dashboard,
              builder: (_, __) => const DashboardScreen(),
            ),
            GoRoute(
              path: AppRoutes.tbt,
              name: RouteNames.tbt,
              builder: (_, __) => const CatalogScreen(),
            ),
            GoRoute(
              path: AppRoutes.workshops,
              name: RouteNames.workshops,
              builder: (_, __) => const WorkshopsScreen(),
            ),
            GoRoute(
              path: AppRoutes.search,
              name: RouteNames.search,
              builder: (_, __) => const SearchScreen(),
            ),
            GoRoute(
              path: AppRoutes.notifications,
              name: RouteNames.notifications,
              builder: (_, __) => const NotificationsScreen(),
            ),
            GoRoute(
              path: AppRoutes.messages,
              name: RouteNames.messages,
              builder: (_, __) => const MessagesScreen(),
            ),
          ]),
          // Branch 1 — WINS.
          StatefulShellBranch(routes: [
            GoRoute(
              path: AppRoutes.wins,
              name: RouteNames.wins,
              builder: (_, __) => const WinsScreen(),
            ),
          ]),
          // Branch 2 — Voice of Sakthi (podcasts).
          StatefulShellBranch(routes: [
            GoRoute(
              path: AppRoutes.podcasts,
              name: RouteNames.podcasts,
              builder: (_, __) => const PodcastsScreen(),
            ),
          ]),
          // Branch 3 — COURSES (catalog listing).
          StatefulShellBranch(routes: [
            GoRoute(
              path: AppRoutes.courses,
              name: RouteNames.courses,
              builder: (_, __) => const CoursesScreen(),
            ),
          ]),
          // Branch 4 — PROFILE.
          StatefulShellBranch(routes: [
            GoRoute(
              path: AppRoutes.profile,
              name: RouteNames.profile,
              builder: (_, __) => const ProfileScreen(),
            ),
          ]),
        ],
      ),

      // ── Outside shell — Profile extras (2026-07-28) ────────────────────────
      GoRoute(
        path: AppRoutes.profileConnections,
        name: RouteNames.profileConnections,
        builder: (_, __) => const ConnectionsScreen(),
      ),
      GoRoute(
        path: AppRoutes.legalTerms,
        name: RouteNames.legalTerms,
        builder: (_, __) => const LegalPageScreen(slug: 'terms'),
      ),
      GoRoute(
        path: AppRoutes.legalPrivacy,
        name: RouteNames.legalPrivacy,
        builder: (_, __) => const LegalPageScreen(slug: 'privacy'),
      ),

      // ── Outside shell — Workshop detail ────────────────────────────────────
      GoRoute(
        path: AppRoutes.workshopDetail,
        name: RouteNames.workshopDetail,
        builder: (_, state) => WorkshopDetailScreen(
          workshopId: state.pathParameters['id']!,
        ),
      ),

      // ── Outside shell — Workshop episode player ────────────────────────────
      GoRoute(
        path: AppRoutes.workshopEpisode,
        name: RouteNames.workshopEpisode,
        builder: (_, state) => WorkshopEpisodePlayerScreen(
          workshopSlug: state.pathParameters['workshopSlug']!,
          episodeId: state.pathParameters['episodeId']!,
        ),
      ),

      // ── Outside shell — Conversation detail ────────────────────────────────
      GoRoute(
        path: AppRoutes.conversationDetail,
        name: RouteNames.conversationDetail,
        builder: (_, state) => ConversationScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),

      // (Courses now lives inside the StatefulShellRoute branches above.)

      // ── Outside shell — Learning ───────────────────────────────────────────
      GoRoute(
        path: AppRoutes.learning,
        name: RouteNames.learning,
        builder: (_, __) => const LearningOverviewScreen(),
        routes: [
          GoRoute(
            path: 'badges',
            name: RouteNames.learningBadges,
            builder: (_, __) => const BadgesScreen(),
          ),
          GoRoute(
            path: ':courseId',
            name: RouteNames.courseDetail,
            builder: (_, state) => CourseDetailScreen(
              courseId: state.pathParameters['courseId']!,
            ),
            routes: [
              GoRoute(
                path: ':lessonId',
                name: RouteNames.lessonPlayer,
                builder: (_, state) => LessonPlayerScreen(
                  courseId: state.pathParameters['courseId']!,
                  lessonId: state.pathParameters['lessonId']!,
                ),
              ),
            ],
          ),
        ],
      ),

      // ── Outside shell — Batch program ──────────────────────────────────────
      GoRoute(
        path: AppRoutes.batchProgram,
        name: RouteNames.batchProgram,
        builder: (_, __) => const BatchProgramScreen(),
      ),
      GoRoute(
        path: AppRoutes.batchDay,
        name: RouteNames.batchDay,
        builder: (_, state) => BatchDayScreen(
          day: int.tryParse(state.pathParameters['day'] ?? '1') ?? 1,
        ),
      ),

      // ── Outside shell — Member pages ───────────────────────────────────────
      GoRoute(
        path: AppRoutes.products,
        name: RouteNames.products,
        builder: (_, __) => const ProductsScreen(),
      ),
      GoRoute(
        path: AppRoutes.resources,
        name: RouteNames.resources,
        builder: (_, __) => const ResourcesScreen(),
      ),
      GoRoute(
        path: AppRoutes.history,
        name: RouteNames.history,
        builder: (_, __) => const HistoryScreen(),
      ),
      GoRoute(
        path: AppRoutes.aiContent,
        name: RouteNames.aiContent,
        builder: (_, __) => const AIContentScreen(),
      ),

      // ── Outside shell — Community feed ────────────────────────────────────
      GoRoute(
        path: AppRoutes.community,
        name: RouteNames.community,
        builder: (_, __) => const CommunityScreen(),
      ),
      GoRoute(
        path: AppRoutes.communitySaved,
        name: RouteNames.communitySaved,
        builder: (_, __) => const SavedPostsScreen(),
      ),

      // ── Outside shell — Podcasts (root /podcasts now inside shell) ────────
      GoRoute(
        path: AppRoutes.podcastSeriesDetail,
        name: RouteNames.podcastSeriesDetail,
        builder: (_, state) => PodcastSeriesScreen(
          seriesId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.podcastPlayer,
        name: RouteNames.podcastPlayer,
        builder: (_, __) => const PodcastPlayerScreen(),
      ),

      // ── Outside shell — E-books ────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.ebooks,
        name: RouteNames.ebooks,
        builder: (_, __) => const EbooksScreen(),
      ),
      GoRoute(
        path: AppRoutes.ebookBookmarks,
        name: RouteNames.ebookBookmarks,
        builder: (_, __) => const EbookBookmarksScreen(),
      ),
      GoRoute(
        path: AppRoutes.ebookDetail,
        name: RouteNames.ebookDetail,
        builder: (_, state) => EbookDetailScreen(bookId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.ebookReader,
        name: RouteNames.ebookReader,
        builder: (_, state) => EbookReaderScreen(bookId: state.pathParameters['id']!),
      ),

      // ── Outside shell — Support ────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.support,
        name: RouteNames.support,
        builder: (_, state) => SupportScreen(
          focusFaqId: state.uri.queryParameters['faqId'],
        ),
      ),
      GoRoute(
        path: AppRoutes.supportContact,
        name: RouteNames.supportContact,
        builder: (_, __) => const SupportContactScreen(),
      ),
      GoRoute(
        path: AppRoutes.supportFeedback,
        name: RouteNames.supportFeedback,
        builder: (_, __) => const SupportFeedbackScreen(),
      ),
      GoRoute(
        path: AppRoutes.supportMyTickets,
        name: RouteNames.supportMyTickets,
        builder: (_, __) => const SupportMyTicketsScreen(),
      ),
      GoRoute(
        path: AppRoutes.supportTicketDetail,
        builder: (_, state) => SupportTicketDetailScreen(
          ticketId: state.pathParameters['id']!,
        ),
      ),

      // ── Outside shell — TBT Points ─────────────────────────────────────────
      GoRoute(
        path: AppRoutes.tbtPoints,
        name: RouteNames.tbtPoints,
        builder: (_, __) => const TbtPointsScreen(),
      ),

      // ── Outside shell — Events ─────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.events,
        name: RouteNames.events,
        builder: (_, __) => const EventsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            name: RouteNames.eventDetail,
            builder: (_, state) => EventDetailScreen(
              eventId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),

      // ── Outside shell — Webinars ───────────────────────────────────────────
      GoRoute(
        path: AppRoutes.webinars,
        name: RouteNames.webinars,
        builder: (_, __) => const WebinarsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            name: RouteNames.webinarDetail,
            builder: (_, state) => WebinarDetailScreen(
              webinarId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),

      // ── Outside shell — Programs ───────────────────────────────────────────
      // On the web, /programs is a re-branded courses view and /programs/:id
      // is rendered by the course detail page. Mirror that here so members
      // get the full curriculum + leaderboard + enrollment flow instead of
      // the old batch-programs stub.
      GoRoute(
        path: AppRoutes.programs,
        name: RouteNames.programs,
        builder: (_, __) => const CoursesScreen(),
        routes: [
          GoRoute(
            path: ':id',
            name: RouteNames.programDetail,
            builder: (_, state) => CourseDetailScreen(
              courseId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),

      // ── Outside shell — Live call ──────────────────────────────────────────
      GoRoute(
        path: AppRoutes.liveCall,
        name: RouteNames.liveCall,
        builder: (_, state) => LiveCallScreen(
          workshopSlug: state.pathParameters['workshopSlug']!,
          callId: state.pathParameters['callId']!,
        ),
      ),

      // ── Outside shell — Standalone webinar ─────────────────────────────────
      // `/live/:webinarId` — one path param. GoRouter matches this before the
      // two-param `/live/:workshopSlug/:callId` because segment count differs.
      GoRoute(
        path: AppRoutes.webinar,
        name: RouteNames.webinar,
        builder: (_, state) => WebinarScreen(
          webinarId: state.pathParameters['webinarId']!,
        ),
      ),
    ];

// ── App root ──────────────────────────────────────────────────────────────────

class TbtApp extends ConsumerStatefulWidget {
  const TbtApp({super.key});

  @override
  ConsumerState<TbtApp> createState() => _TbtAppState();
}

class _TbtAppState extends ConsumerState<TbtApp> with WidgetsBindingObserver {
  bool _deepLinkChecked = false;

  /// Timestamp of the last successful token refresh (or authenticated boot).
  /// Used to decide whether an `AppLifecycleState.resumed` warrants a
  /// proactive refresh — access tokens have a 15-min TTL, so a refresh at
  /// the 12-min mark keeps subsequent requests instant.
  DateTime? _lastRefreshAt;
  static const _kProactiveRefreshAfter = Duration(minutes: 12);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _lastRefreshAt = DateTime.now();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    _maybeProactiveRefresh();
  }

  /// If the app has been idle long enough that the access token is close to
  /// expiry (or already expired), fire a background refresh so the very
  /// next authenticated request doesn't have to go through the 401→refresh
  /// dance. Failures are safe — `AuthService.refresh` follows the
  /// session-preservation rule (only wipes on 401/403 from `/refresh`
  /// itself), so a poor connection here never signs the user out.
  Future<void> _maybeProactiveRefresh() async {
    final authAsync = ref.read(authNotifierProvider);
    if (authAsync.valueOrNull?.step != AuthStep.authenticated) return;
    final last = _lastRefreshAt;
    if (last != null &&
        DateTime.now().difference(last) < _kProactiveRefreshAfter) {
      return;
    }
    try {
      await ref.read(authServiceProvider).refresh();
      _lastRefreshAt = DateTime.now();
      if (kDebugMode) debugPrint('[TbtApp] proactive refresh succeeded');
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[TbtApp] proactive refresh failed: $e (session kept)');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    // Eagerly initialize the socket provider and all global socket event
    // handlers so they are active from the moment the user logs in,
    // regardless of which screen is currently visible.
    ref.watch(socketNotifierProvider);
    ref.read(batchDayApprovedNotifierProvider);
    ref.read(courseAccessEventNotifierProvider);
    ref.read(workshopEventHandlerProvider);

    // Wire FCM foreground + background-tap handlers once the router is ready.
    ref.read(fcmServiceProvider).initHandlers(router);

    // Consume any pending deep-link stored from a terminated-state
    // notification tap as soon as the user is authenticated.
    //
    // Race guard rationale — the flow is fragile:
    //   1. User taps a notification while the app is fully killed.
    //   2. Android launches Flutter → the app decides its initial route
    //      (usually `/dashboard` if the JWT cookies are still valid).
    //   3. FCM's `getInitialMessage` fires and _fcmService_ writes the
    //      target route into SharedPreferences (kPrefPendingDeepLink).
    //   4. `AuthNotifier.build()` completes; we see `authenticated` and
    //      run the consume logic below.
    //
    // Two things can break: (a) if we `router.go(route)` before the
    // router's initial-render completes, GoRouter re-runs its redirect
    // guard and can bounce us; (b) if the user is temporarily unauth
    // (network hiccup during cold-start refresh) we skip the payload and
    // it stays queued for the NEXT authenticated session — which is fine.
    // The `_deepLinkChecked` flag ensures we only fire once per app lifetime.
    ref.listen<AsyncValue<AuthState>>(authNotifierProvider, (_, next) async {
      if (_deepLinkChecked) return;
      if (next.valueOrNull?.step != AuthStep.authenticated) return;
      _deepLinkChecked = true;
      try {
        final prefs = await SharedPreferences.getInstance();
        final route = prefs.getString(kPrefPendingDeepLink);
        if (route == null || route.isEmpty) {
          if (kDebugMode) {
            debugPrint('[TbtApp] no pending deep link on auth');
          }
          return;
        }
        // Clear the payload immediately so a second auth transition
        // (e.g. a token refresh mid-session) doesn't replay it.
        await prefs.remove(kPrefPendingDeepLink);
        // Wait for the router's first frame — 300 ms is deliberately
        // generous; on very old Android devices the initial redirect
        // chain can take ~200 ms.
        await Future<void>.delayed(const Duration(milliseconds: 300));
        if (!mounted) {
          if (kDebugMode) {
            debugPrint('[TbtApp] widget unmounted before deep-link '
                'navigate — route "$route" dropped');
          }
          return;
        }
        if (kDebugMode) debugPrint('[TbtApp] navigating to deep link: $route');
        router.go(route);
      } catch (e, st) {
        if (kDebugMode) {
          debugPrint('[TbtApp] deep-link consume failed: $e\n$st');
        }
      }
    });

    final siteConfigAsync = ref.watch(siteConfigNotifierProvider);
    final tbtTheme = siteConfigAsync.whenOrNull(
          data: (cfg) => TbtTheme.fromSiteConfig(cfg.theme),
        ) ??
        TbtTheme.defaults;

    final themeMode = ref.watch(themeModeProvider);
    // Resolve effective brightness for OS chrome (status bar / nav bar).
    // Doing it at the root ensures the system chrome flips together with
    // MaterialApp themes when the user toggles the mode.
    final effectiveBrightness = switch (themeMode) {
      ThemeMode.dark => Brightness.dark,
      ThemeMode.light => Brightness.light,
      ThemeMode.system => MediaQuery.platformBrightnessOf(context),
    };
    // Belt: imperative one-shot so cold-start / hot-reload has a sane
    // overlay before the first frame renders.
    SystemChrome.setSystemUIOverlayStyle(systemOverlayFor(effectiveBrightness));
    // Braces: the AnnotatedRegion below wraps every route so the OS
    // chrome is guaranteed to re-apply the theme default whenever a
    // screen-level StatusBarScope (login, splash, video players) pops
    // off the stack. Without this, popping a locked-dark overlay
    // could leave stale white icons on a light theme page.
    final rootOverlay = systemOverlayFor(effectiveBrightness);

    return MaterialApp.router(
      title: 'Tamil Business Tribe',
      debugShowCheckedModeBanner: false,
      theme: buildLightTheme(tbtTheme),
      darkTheme: buildDarkTheme(tbtTheme),
      themeMode: themeMode,
      routerConfig: router,
      localizationsDelegates: AppL10n.localizationsDelegates,
      supportedLocales: AppL10n.supportedLocales,
      // Platform-adaptive scroll physics + Android 12 stretch
      // overscroll + trackpad/mouse support. See AppScrollBehavior.
      scrollBehavior: const AppScrollBehavior(),
      builder: (context, child) {
        // Respect the user's OS-level text-size preference (accessibility
        // large-text setting), but clamp at 1.4x so multi-line labels and
        // fixed-height rows don't overflow. Larger scales cause clipping
        // in dense list cards; clamping is standard practice.
        //
        // `sizeOf` / `textScalerOf` establish narrow dependencies so this
        // builder rebuilds only when the scale actually changes, not on
        // every MediaQueryData field mutation.
        final scale = MediaQuery.textScalerOf(context).clamp(
          minScaleFactor: 0.85,
          maxScaleFactor: 1.4,
        );
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: scale),
          // AnnotatedRegion is the widget-tree-based OS-chrome control.
          // Placing it here — above _GlobalBackGate — ensures every
          // route inherits the theme-appropriate overlay by default.
          // Screens like login/splash/video-players nest their own
          // StatusBarScope inside; when those unmount, the framework
          // walks back up the tree, finds THIS region, and restores
          // the theme default automatically.
          child: AnnotatedRegion<SystemUiOverlayStyle>(
            value: rootOverlay,
            // Global back-button handler — wraps every route (both
            // inside the ShellRoute and the top-level detail screens
            // like /podcasts/player, /learning/*, /ebooks/*). Without
            // this the Android back gesture on outside-shell routes
            // would fall through to the OS and close the app when
            // the router stack is empty.
            child: _GlobalBackGate(child: child ?? const SizedBox.shrink()),
          ),
        );
      },
    );
  }
}

// ── Global back-button gate ───────────────────────────────────────────────────
//
// Wraps every route (inside AND outside the ShellRoute) so the Android
// system back / gesture always follows platform-standard behavior:
//
//   1. If GoRouter can pop (a pushed detail screen) → pop.
//   2. Else if we're not on /dashboard → jump to /dashboard.
//   3. Else on /dashboard → "back to exit" pattern (double tap
//      within 2 s to actually leave the app).
//
// This is layered ABOVE the shell's own PopScope. When both are in the
// tree the innermost (the shell's) intercepts first — this outer gate
// only fires for routes rendered outside the shell.

class _GlobalBackGate extends StatefulWidget {
  const _GlobalBackGate({required this.child});
  final Widget child;

  @override
  State<_GlobalBackGate> createState() => _GlobalBackGateState();
}

class _GlobalBackGateState extends State<_GlobalBackGate> {
  DateTime? _lastBackPress;
  static const _kExitConfirmWindow = Duration(seconds: 2);

  /// Paths that live inside the `StatefulShellRoute` — `_AppShell` owns
  /// their back handling. Flutter fires EVERY registered PopScope on the
  /// current ModalRoute (not just the innermost), so if we ran on these
  /// paths too we'd double-navigate and confuse the shell into exiting.
  /// Kept in sync with the branch definitions in `_buildRoutes`.
  static const _kShellPaths = {
    AppRoutes.dashboard,
    AppRoutes.tbt,
    AppRoutes.workshops,
    AppRoutes.search,
    AppRoutes.notifications,
    AppRoutes.messages,
    AppRoutes.wins,
    AppRoutes.podcasts,
    AppRoutes.courses,
    AppRoutes.profile,
  };

  Future<void> _handleGlobalBack() async {
    final currentPath = GoRouterState.of(context).uri.path;
    // Inside the shell → let `_AppShell` be the single source of truth.
    if (_kShellPaths.contains(currentPath)) return;

    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
      return;
    }

    if (currentPath != AppRoutes.dashboard) {
      context.go(AppRoutes.dashboard);
      return;
    }

    final now = DateTime.now();
    final lastPress = _lastBackPress;
    if (lastPress != null &&
        now.difference(lastPress) < _kExitConfirmWindow) {
      await SystemNavigator.pop();
      return;
    }

    _lastBackPress = now;
    if (!mounted) return;
    final l10n = AppL10n.of(context);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(l10n?.backToExitPrompt ?? 'Press back again to exit'),
          duration: _kExitConfirmWindow,
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleGlobalBack();
      },
      child: widget.child,
    );
  }
}

// ── Authenticated shell ───────────────────────────────────────────────────────

class _AppShell extends ConsumerStatefulWidget {
  const _AppShell({required this.navigationShell, required this.child});

  /// The stateful shell that manages branch navigators. Passed through to
  /// [AppBottomTabBar] so tab taps jump between branches (preserving each
  /// branch's stack) instead of replacing the whole router stack.
  final StatefulNavigationShell navigationShell;
  final Widget child;

  @override
  ConsumerState<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<_AppShell> {
  /// Tracks the last Android system-back press timestamp so we can implement
  /// the platform-standard "press back again to exit" pattern on the root
  /// tab. Nulled when the interval window expires so a stale press doesn't
  /// accidentally exit later.
  DateTime? _lastBackPress;

  static const _kExitConfirmWindow = Duration(seconds: 2);

  /// Handles hardware / gesture back on the authenticated shell.
  ///
  /// Order of preference:
  ///   1. If the active branch's Navigator has a route to pop (a `push`ed
  ///      detail screen), let it pop.
  ///   2. Else if we're not on the Home branch, jump to Home so back always
  ///      converges on `/dashboard` before quitting.
  ///   3. Else on Home branch, require two back presses within
  ///      [_kExitConfirmWindow] to exit; first press just shows a snackbar.
  Future<void> _handleBack() async {
    // An ad on screen owns back first (TBT_ADS_SPECKIT.md §10). It closes the
    // ad when the admin allowed closing, and otherwise swallows the press so
    // back cannot be used to walk past an unskippable ad. The user is never
    // trapped: the overlay's lifetime ceiling always fires.
    if (ref.read(adControllerProvider).handleBackPress()) return;

    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
      return;
    }

    if (widget.navigationShell.currentIndex != 0) {
      widget.navigationShell.goBranch(0);
      return;
    }

    final now = DateTime.now();
    final lastPress = _lastBackPress;
    if (lastPress != null && now.difference(lastPress) < _kExitConfirmWindow) {
      // User confirmed within the window — actually exit.
      await SystemNavigator.pop();
      return;
    }

    _lastBackPress = now;
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context)!.backToExitPrompt),
          duration: _kExitConfirmWindow,
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    // Tablet breakpoint. 600dp is the Material 3 threshold that matches
    // the "compact vs. medium" transition — anything wider gets the
    // permanent nav rail, anything narrower keeps the bottom tab bar.
    final width = MediaQuery.sizeOf(context).width;
    final isTablet = width >= 600;

    // Dashboard renders its own custom HomeHeader (Module 9B), so hide
    // the shell AppNavbar there to avoid two stacked headers.
    final currentPath = GoRouterState.of(context).uri.path;
    final hideAppNavbar = currentPath == AppRoutes.dashboard;

    // `canPop: false` tells the framework we're taking full control of the
    // pop gesture — `onPopInvokedWithResult` decides what actually happens.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: Scaffold(
        drawer: isTablet ? null : const TbtAppDrawer(),
        drawerEdgeDragWidth: 24,
        appBar: hideAppNavbar ? null : const AppNavbar(),
        body: isTablet
            ? Row(
                children: [
                  // `AppSideNavRail` takes no arguments — it reads the current
                  // location from GoRouterState and navigates with context.go
                  // itself. Passing `navigationShell:` here was a compile error
                  // left over from a half-finished StatefulShellRoute
                  // migration: the shell was converted, the two tab widgets
                  // were not. Completing that migration (so tab switches use
                  // goBranch and preserve per-branch stacks, per CLAUDE.md) is
                  // a behaviour change, not a build fix, and is left alone.
                  const AppSideNavRail(),
                  const VerticalDivider(width: 1, thickness: 1),
                  Expanded(child: widget.child),
                ],
              )
            : widget.child,
        bottomNavigationBar: isTablet
            ? null
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const PodcastMiniPlayer(),
                  // Same as AppSideNavRail above — no arguments.
                  const AppBottomTabBar(),
                ],
              ),
      ),
    );
  }
}
