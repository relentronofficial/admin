import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/routes.dart';
import '../data/events_service.dart';
import '../providers/events_provider.dart';

import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_error_state.dart';
class EventsScreen extends ConsumerStatefulWidget {
  const EventsScreen({super.key});

  @override
  ConsumerState<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends ConsumerState<EventsScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = v.trim().toLowerCase());
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(eventsProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          'EVENTS',
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
            onPressed: () => ref.invalidate(eventsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xs,
            ),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              style: TextStyle(color: context.tokens.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                isDense: true,
                prefixIcon: Icon(Icons.search,
                    color: context.tokens.textMuted, size: 18),
                suffixIcon: _searchCtrl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: Icon(Icons.close,
                            color: context.tokens.textMuted, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          _onSearchChanged('');
                        },
                      ),
                hintText: 'Search events…',
                hintStyle: TextStyle(color: context.tokens.textMuted),
                filled: true,
                fillColor: context.tokens.bgInput,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2)),
              error: (e, _) => AppErrorState(
                error: e,
                fallbackTitle: 'Failed to load events',
                onRetry: () => ref.invalidate(eventsProvider),
              ),
              data: (allEvents) {
                final events = _query.isEmpty
                    ? allEvents
                    : allEvents.where((e) {
                        return (e.title.toLowerCase().contains(_query)) ||
                            ((e.description ?? '')
                                .toLowerCase()
                                .contains(_query));
                      }).toList();
                if (events.isEmpty) {
                  return AppEmptyState(
                    icon: Icons.event_outlined,
                    title: _query.isEmpty
                        ? 'No events available'
                        : 'No events match "$_query"',
                    subtitle: _query.isEmpty
                        ? 'Upcoming sessions will show up here.'
                        : null,
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  itemCount: events.length,
                  itemBuilder: (_, i) => RepaintBoundary(
                    child: _EventCard(
                      event: events[i],
                      onTap: () => context
                          .push(AppRoutes.eventDetailPath(events[i].id)),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Event card ────────────────────────────────────────────────────────────────

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.onTap});

  final TbtEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final date = event.parsedDate;

    return Semantics(
      label: event.title,
      button: true,
      child: AppCard(
        margin: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs + 1,
        ),
        padding: EdgeInsets.zero,
        onTap: onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date badge
            if (date != null) _DateBadge(date: date),

            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _StatusChip(context, status: event.status),
                        const SizedBox(width: 6),
                        _TypeChip(type: event.eventType),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      event.title,
                      style: TextStyle(
                        color: context.tokens.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (date != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.schedule_outlined,
                              size: 12, color: context.tokens.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            DateFormat('EEE, MMM d · h:mm a').format(date),
                            style: TextStyle(
                              color: context.tokens.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (event.location != null ||
                        event.isOnline) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Icon(
                            event.isOnline
                                ? Icons.videocam_outlined
                                : Icons.location_on_outlined,
                            size: 12,
                            color: context.tokens.textMuted,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              event.isOnline
                                  ? 'Online'
                                  : event.location ?? '',
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
            ),

            Padding(
              padding: const EdgeInsets.only(
                right: AppSpacing.sm + 2,
                top: AppSpacing.md + 2,
              ),
              child: Icon(Icons.chevron_right,
                  color: context.tokens.textMuted, size: AppIconSize.sm),
            ),
          ],
        ),
      ),
    );
  }
}

class _DateBadge extends StatelessWidget {
  const _DateBadge({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      margin: const EdgeInsets.all(AppSpacing.md),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs + 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            DateFormat('MMM').format(date).toUpperCase(),
            style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          Text(
            DateFormat('d').format(date),
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.1,
            ),
          ),
          Text(
            DateFormat('EEE').format(date).toUpperCase(),
            style: TextStyle(
              color: context.tokens.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(BuildContext context, {required this.status});

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
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: c,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.type});

  final String type;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: context.tokens.bgInput,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        type.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(
          color: context.tokens.textMuted,
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
