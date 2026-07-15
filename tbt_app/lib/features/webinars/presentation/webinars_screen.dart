import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/routes.dart';
import '../data/webinars_service.dart';
import '../providers/webinars_provider.dart';

import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_error_state.dart';
import '../../../shared/widgets/app_network_image.dart';
class WebinarsScreen extends ConsumerWidget {
  const WebinarsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(webinarsProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'WEBINARS',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: context.tokens.textMuted, size: 20),
            onPressed: () => ref.invalidate(webinarsProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => AppErrorState(
          error: e,
          fallbackTitle: 'Failed to load webinars',
          onRetry: () => ref.invalidate(webinarsProvider),
        ),
        data: (webinars) {
          if (webinars.isEmpty) {
            return const AppEmptyState(
              icon: Icons.videocam_outlined,
              title: 'No webinars available',
              subtitle: 'Check back — new live sessions are announced regularly.',
            );
          }
          return RefreshIndicator(
            color: Theme.of(context).colorScheme.primary,
            backgroundColor: context.tokens.bgSurface,
            onRefresh: () async {
              ref.invalidate(webinarsProvider);
              await ref.read(webinarsProvider.future);
            },
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              itemCount: webinars.length,
              itemBuilder: (_, i) => _WebinarCard(
                webinar: webinars[i],
                onTap: () => context
                    .push(AppRoutes.webinarDetailPath(webinars[i].id)),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _WebinarCard extends StatelessWidget {
  const _WebinarCard({required this.webinar, required this.onTap});

  final TbtWebinar webinar;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheduled = webinar.parsedScheduledAt;

    return Semantics(
      label: webinar.title,
      button: true,
      child: AppCard(
        margin: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs + 1,
        ),
        padding: EdgeInsets.zero,
        onTap: onTap,
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thumbnail with LIVE / date overlay
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AppNetworkImage(
                      url: webinar.thumbnailUrl,
                      width: 480,
                      fit: BoxFit.cover,
                      fallbackIcon: Icons.videocam_outlined,
                    ),
                    if (webinar.isLive)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.circle,
                                  size: 8, color: Colors.white),
                              SizedBox(width: 4),
                              Text(
                                'LIVE',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      webinar.title,
                      style: TextStyle(
                        color: context.tokens.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (scheduled != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.schedule_outlined,
                              size: 12, color: context.tokens.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            DateFormat('EEE, MMM d · h:mm a').format(scheduled),
                            style: TextStyle(
                              color: context.tokens.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (webinar.host != null && webinar.host!.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Icon(Icons.person_outline,
                              size: 12, color: context.tokens.textMuted),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              webinar.host!,
                              style: TextStyle(
                                color: context.tokens.textMuted,
                                fontSize: 11,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

