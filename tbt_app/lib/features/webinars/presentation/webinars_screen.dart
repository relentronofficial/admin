import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../data/webinars_service.dart';
import '../providers/webinars_provider.dart';

class WebinarsScreen extends ConsumerWidget {
  const WebinarsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(webinarsProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: kColorBgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: kColorTextPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'WEBINARS',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: kColorTextPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: kColorTextMuted, size: 20),
            onPressed: () => ref.invalidate(webinarsProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: kColorTextMuted, size: 40),
              const SizedBox(height: 12),
              const Text('Failed to load webinars',
                  style: TextStyle(color: kColorTextSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(webinarsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (webinars) {
          if (webinars.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.videocam_outlined,
                      color: kColorTextMuted, size: 40),
                  SizedBox(height: 12),
                  Text('No webinars available',
                      style: TextStyle(
                          color: kColorTextSecondary, fontSize: 14)),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: kColorAccent,
            backgroundColor: kColorBgSurface,
            onRefresh: () async {
              ref.invalidate(webinarsProvider);
              await ref.read(webinarsProvider.future);
            },
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
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
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: kColorBgSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: kColorBorderCard),
          ),
          clipBehavior: Clip.hardEdge,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thumbnail with LIVE / date overlay
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (webinar.thumbnailUrl != null)
                      CachedNetworkImage(
                        imageUrl: webinar.thumbnailUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) =>
                            const _ThumbPlaceholder(),
                      )
                    else
                      const _ThumbPlaceholder(),
                    if (webinar.isLive)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: kColorAccent,
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
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      webinar.title,
                      style: const TextStyle(
                        color: kColorTextPrimary,
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
                          const Icon(Icons.schedule_outlined,
                              size: 12, color: kColorTextMuted),
                          const SizedBox(width: 4),
                          Text(
                            DateFormat('EEE, MMM d · h:mm a').format(scheduled),
                            style: const TextStyle(
                              color: kColorTextMuted,
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
                          const Icon(Icons.person_outline,
                              size: 12, color: kColorTextMuted),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              webinar.host!,
                              style: const TextStyle(
                                color: kColorTextMuted,
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
      ),
    );
  }
}

class _ThumbPlaceholder extends StatelessWidget {
  const _ThumbPlaceholder();

  @override
  Widget build(BuildContext context) => Container(
        color: kColorBgInput,
        child: const Center(
          child: Icon(Icons.videocam_outlined,
              color: kColorTextSubtle, size: 32),
        ),
      );
}
