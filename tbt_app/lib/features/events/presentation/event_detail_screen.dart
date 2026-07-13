import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/theme/design_constants.dart';
import '../providers/events_provider.dart';

class EventDetailScreen extends ConsumerWidget {
  const EventDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(eventProvider(eventId));

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
          'EVENT DETAILS',
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
              const Icon(Icons.error_outline, color: kColorTextMuted, size: 40),
              const SizedBox(height: 12),
              const Text('Failed to load event',
                  style: TextStyle(color: kColorTextSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(eventProvider(eventId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (event) {
          final date = event.parsedDate;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title + status row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        event.title,
                        style: const TextStyle(
                          color: kColorTextPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _StatusBadge(status: event.status),
                  ],
                ),

                const SizedBox(height: 16),

                // Info cards
                _InfoCard(
                  children: [
                    if (date != null)
                      _InfoRow(
                        icon: Icons.calendar_today_outlined,
                        label: 'Date & Time',
                        value: DateFormat('EEEE, MMMM d, y · h:mm a')
                            .format(date),
                      ),
                    _InfoRow(
                      icon: event.isOnline
                          ? Icons.videocam_outlined
                          : Icons.location_on_outlined,
                      label: event.isOnline ? 'Format' : 'Location',
                      value: event.isOnline
                          ? 'Online Event'
                          : (event.location ?? 'TBD'),
                    ),
                    _InfoRow(
                      icon: Icons.category_outlined,
                      label: 'Type',
                      value: event.eventType
                          .replaceAll('_', ' ')
                          .split(' ')
                          .map((w) =>
                              w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
                          .join(' '),
                    ),
                    if (event.maxAttendees != null)
                      _InfoRow(
                        icon: Icons.people_outline,
                        label: 'Capacity',
                        value: '${event.maxAttendees} attendees',
                      ),
                  ],
                ),

                if (event.description != null &&
                    event.description!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'ABOUT THIS EVENT',
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
                      event.description!,
                      style: const TextStyle(
                        color: kColorTextSecondary,
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                  ),
                ],

                if (event.registrationUrl != null &&
                    event.registrationUrl!.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kColorAccent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      icon: const Icon(Icons.open_in_new, size: 18),
                      label: const Text(
                        'REGISTER NOW',
                        style: TextStyle(
                          fontFamily: 'Rajdhani',
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      onPressed: () async {
                        final uri = Uri.tryParse(event.registrationUrl!);
                        if (uri != null) {
                          await launchUrl(uri,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                    ),
                  ),
                ],

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
  const _StatusBadge({required this.status});

  final String status;

  Color get _color {
    switch (status) {
      case 'ongoing':
        return const Color(0xFF16a34a);
      case 'completed':
        return kColorTextMuted;
      case 'cancelled':
        return kColorAccent;
      default:
        return const Color(0xFF1d4ed8);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status.toUpperCase(),
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
            .expand((w) => [w, if (w != children.last) const Divider(color: kColorBorderCard, height: 20)])
            .toList(),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

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
