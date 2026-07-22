import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/events_service.dart';
import '../providers/events_provider.dart';

import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_error_state.dart';
import '../../../shared/widgets/app_section_header.dart';
import '../../../shared/widgets/app_loader.dart';
class EventDetailScreen extends ConsumerStatefulWidget {
  const EventDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  ConsumerState<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends ConsumerState<EventDetailScreen> {
  bool _registering = false;
  bool _registered = false;

  Future<void> _register(TbtEvent event) async {
    setState(() => _registering = true);
    try {
      await ref
          .read(eventsFeatureServiceProvider)
          .registerForEvent(widget.eventId);
      if (!mounted) return;
      setState(() => _registered = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("You're registered!"),
          duration: Duration(seconds: 2),
        ),
      );
      // If the event also has an external registration URL (e.g. for calendar
      // add or third-party ticketing), open it after the in-app registration.
      final url = event.registrationUrl;
      if (url != null && url.isNotEmpty) {
        final uri = Uri.tryParse(url);
        if (uri != null) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Registration failed: $e'),
          duration: const Duration(seconds: 3),
        ),
      );
    } finally {
      if (mounted) setState(() => _registering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final eventId = widget.eventId;
    final async = ref.watch(eventProvider(eventId));

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
          'EVENT DETAILS',
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
            const AppLoader.center(),
        error: (e, _) => AppErrorState(
          error: e,
          fallbackTitle: 'Failed to load event',
          onRetry: () => ref.invalidate(eventProvider(eventId)),
        ),
        data: (event) {
          final date = event.parsedDate;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
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
                        style: TextStyle(
                          color: context.tokens.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    _StatusBadge(status: event.status),
                  ],
                ),

                const SizedBox(height: AppSpacing.lg),

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
                  const SizedBox(height: AppSpacing.lg),
                  const AppSectionHeader(
                    label: 'About this event',
                    padding: EdgeInsets.only(bottom: AppSpacing.sm),
                  ),
                  AppCard(
                    padding: const EdgeInsets.all(AppSpacing.md + 2),
                    child: Text(
                      event.description!,
                      style: TextStyle(
                        color: context.tokens.textSecondary,
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                  ),
                ],

                if (event.isUpcoming) ...[
                  const SizedBox(height: AppSpacing.xxl),
                  AppPrimaryButton(
                    label: _registered ? 'Registered' : 'Register now',
                    icon: _registered
                        ? Icons.check_circle_outline
                        : Icons.event_available,
                    size: AppButtonSize.lg,
                    fullWidth: true,
                    isLoading: _registering,
                    onPressed: (_registering || _registered)
                        ? null
                        : () => _register(event),
                  ),
                ],

                const SizedBox(height: AppSpacing.xxl),
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

  Color _color(BuildContext context) {
    switch (status) {
      case 'ongoing':
        return const Color(0xFF16a34a);
      case 'completed':
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
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Text(
        status.toUpperCase(),
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
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md + 2),
      child: Column(
        children: children
            .expand((w) => [
                  w,
                  if (w != children.last)
                    Divider(color: context.tokens.borderCard, height: AppSpacing.xl),
                ])
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
