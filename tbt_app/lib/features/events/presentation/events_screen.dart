import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../data/events_service.dart';
import '../providers/events_provider.dart';

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
        backgroundColor: kColorBgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'EVENTS',
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
            onPressed: () => ref.invalidate(eventsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              style: const TextStyle(color: kColorTextPrimary, fontSize: 14),
              decoration: InputDecoration(
                isDense: true,
                prefixIcon: const Icon(Icons.search,
                    color: kColorTextMuted, size: 18),
                suffixIcon: _searchCtrl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close,
                            color: kColorTextMuted, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          _onSearchChanged('');
                        },
                      ),
                hintText: 'Search events…',
                hintStyle: const TextStyle(color: kColorTextMuted),
                filled: true,
                fillColor: kColorBgInput,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: kColorBorderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: kColorBorderCard),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2)),
              error: (_, __) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        color: kColorTextMuted, size: 40),
                    const SizedBox(height: 12),
                    const Text('Failed to load events',
                        style: TextStyle(color: kColorTextSecondary)),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => ref.invalidate(eventsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
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
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.event_outlined,
                            color: kColorTextMuted, size: 40),
                        const SizedBox(height: 12),
                        Text(
                          _query.isEmpty
                              ? 'No events available'
                              : 'No events match "$_query"',
                          style: const TextStyle(
                              color: kColorTextSecondary, fontSize: 14),
                        ),
                      ],
                    ),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: events.length,
                  itemBuilder: (_, i) => _EventCard(
                    event: events[i],
                    onTap: () => context
                        .push(AppRoutes.eventDetailPath(events[i].id)),
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
      child: GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: kColorBgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: kColorBorderCard),
        ),
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
                        _StatusChip(status: event.status),
                        const SizedBox(width: 6),
                        _TypeChip(type: event.eventType),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      event.title,
                      style: const TextStyle(
                        color: kColorTextPrimary,
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
                          const Icon(Icons.schedule_outlined,
                              size: 12, color: kColorTextMuted),
                          const SizedBox(width: 4),
                          Text(
                            DateFormat('EEE, MMM d · h:mm a').format(date),
                            style: const TextStyle(
                              color: kColorTextMuted,
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
                            color: kColorTextMuted,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              event.isOnline
                                  ? 'Online'
                                  : event.location ?? '',
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
            ),

            const Padding(
              padding: EdgeInsets.only(right: 10, top: 14),
              child: Icon(Icons.chevron_right,
                  color: kColorTextMuted, size: 18),
            ),
          ],
        ),
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
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: kColorAccent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kColorAccent.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            DateFormat('MMM').format(date).toUpperCase(),
            style: const TextStyle(
              color: kColorAccent,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          Text(
            DateFormat('d').format(date),
            style: const TextStyle(
              color: kColorTextPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.1,
            ),
          ),
          Text(
            DateFormat('EEE').format(date).toUpperCase(),
            style: const TextStyle(
              color: kColorTextMuted,
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
  const _StatusChip({required this.status});

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
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: _color,
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
        color: kColorBgInput,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        type.replaceAll('_', ' ').toUpperCase(),
        style: const TextStyle(
          color: kColorTextMuted,
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
