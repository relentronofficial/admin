import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/routes.dart';
import '../providers/webinars_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
class WebinarDetailScreen extends ConsumerWidget {
  const WebinarDetailScreen({super.key, required this.webinarId});

  final String webinarId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(webinarProvider(webinarId));

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
          'WEBINAR',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
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
              Icon(Icons.error_outline,
                  color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load webinar',
                  style: TextStyle(color: context.tokens.textSecondary)),
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
                          color: context.tokens.bgInput,
                          child: Center(
                            child: Icon(Icons.videocam_outlined,
                                color: context.tokens.textSubtle, size: 40),
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
                        style: TextStyle(
                          color: context.tokens.textPrimary,
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
                  Text(
                    'ABOUT',
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                      color: context.tokens.textMuted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: context.tokens.bgSurface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: context.tokens.borderCard),
                    ),
                    child: Text(
                      webinar.description!,
                      style: TextStyle(
                        color: context.tokens.textSecondary,
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
                          canJoin ? Theme.of(context).colorScheme.primary : context.tokens.bgInput,
                      foregroundColor:
                          canJoin ? Colors.white : context.tokens.textMuted,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      disabledBackgroundColor: context.tokens.bgInput,
                      disabledForegroundColor: context.tokens.textMuted,
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

  Color _color(BuildContext context) {
    if (isLive) return Theme.of(context).colorScheme.primary;
    switch (status) {
      case 'ended':
        return context.tokens.textMuted;
      case 'cancelled':
        return Theme.of(context).colorScheme.primary;
      default:
        return const Color(0xFF1d4ed8);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _color(context);
    final label = isLive ? 'LIVE' : status.toUpperCase();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: c,
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
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Column(
        children: children
            .expand((w) => [
                  w,
                  if (w != children.last)
                    Divider(color: context.tokens.borderCard, height: 20),
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
        Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: context.tokens.textMuted,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  color: context.tokens.textPrimary,
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
