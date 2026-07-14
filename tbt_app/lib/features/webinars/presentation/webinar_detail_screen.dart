import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../providers/webinars_provider.dart';

class WebinarDetailScreen extends ConsumerWidget {
  const WebinarDetailScreen({super.key, required this.webinarId});

  final String webinarId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(webinarProvider(webinarId));

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
          'WEBINAR',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: kColorTextPrimary,
          ),
        ),
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
              const Text('Failed to load webinar',
                  style: TextStyle(color: kColorTextSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(webinarProvider(webinarId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (webinar) {
          final scheduled = webinar.parsedScheduledAt;
          final canJoin = webinar.isLive;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (webinar.thumbnailUrl != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: CachedNetworkImage(
                        imageUrl: webinar.thumbnailUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                          color: kColorBgInput,
                          child: const Center(
                            child: Icon(Icons.videocam_outlined,
                                color: kColorTextSubtle, size: 40),
                          ),
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        webinar.title,
                        style: const TextStyle(
                          color: kColorTextPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _StatusBadge(status: webinar.status, isLive: webinar.isLive),
                  ],
                ),
                const SizedBox(height: 16),
                _InfoCard(
                  children: [
                    if (scheduled != null)
                      _InfoRow(
                        icon: Icons.calendar_today_outlined,
                        label: 'Scheduled',
                        value: DateFormat('EEEE, MMMM d, y · h:mm a')
                            .format(scheduled),
                      ),
                    if (webinar.host != null && webinar.host!.isNotEmpty)
                      _InfoRow(
                        icon: Icons.person_outline,
                        label: 'Host',
                        value: webinar.host!,
                      ),
                    if (webinar.attendeeCount != null)
                      _InfoRow(
                        icon: Icons.people_outline,
                        label: 'Attendees',
                        value: '${webinar.attendeeCount}',
                      ),
                  ],
                ),
                if (webinar.description != null &&
                    webinar.description!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'ABOUT',
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                      color: kColorTextMuted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: kColorBgSurface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: kColorBorderCard),
                    ),
                    child: Text(
                      webinar.description!,
                      style: const TextStyle(
                        color: kColorTextSecondary,
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          canJoin ? kColorAccent : kColorBgInput,
                      foregroundColor:
                          canJoin ? Colors.white : kColorTextMuted,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      disabledBackgroundColor: kColorBgInput,
                      disabledForegroundColor: kColorTextMuted,
                    ),
                    icon: Icon(
                      canJoin
                          ? Icons.play_circle_outline
                          : (webinar.hasEnded
                              ? Icons.replay
                              : Icons.schedule),
                      size: 18,
                    ),
                    label: Text(
                      canJoin
                          ? 'JOIN LIVE'
                          : (webinar.hasEnded ? 'ENDED' : 'NOT YET LIVE'),
                      style: const TextStyle(
                        fontFamily: 'Rajdhani',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                    onPressed: canJoin
                        ? () => context.push(AppRoutes.webinarPath(webinar.id))
                        : null,
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.isLive});

  final String status;
  final bool isLive;

  Color get _color {
    if (isLive) return kColorAccent;
    switch (status) {
      case 'ended':
        return kColorTextMuted;
      case 'cancelled':
        return kColorAccent;
      default:
        return const Color(0xFF1d4ed8);
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = isLive ? 'LIVE' : status.toUpperCase();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: _color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kColorBorderCard),
      ),
      child: Column(
        children: children
            .expand((w) => [
                  w,
                  if (w != children.last)
                    const Divider(color: kColorBorderCard, height: 20),
                ])
            .toList(),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(
      {required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: kColorAccent),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: const TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: kColorTextMuted,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: kColorTextPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
