import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../providers/programs_provider.dart';

class ProgramDetailScreen extends ConsumerWidget {
  const ProgramDetailScreen({super.key, required this.programId});

  final String programId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(programDetailProvider(programId));

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
          'PROGRAM DETAILS',
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
              const Text('Failed to load program',
                  style: TextStyle(color: kColorTextSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(programDetailProvider(programId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (program) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: kColorAccent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.school_outlined,
                        color: kColorAccent, size: 26),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          program.name,
                          style: const TextStyle(
                            color: kColorTextPrimary,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        _StatusBadge(status: program.status),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Stats row
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.calendar_today_outlined,
                      label: 'Duration',
                      value: '${program.durationDays} days',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.hourglass_bottom_outlined,
                      label: 'Incubation',
                      value: '${program.incubationDays} days',
                    ),
                  ),
                ],
              ),

              if (program.description != null &&
                  program.description!.isNotEmpty) ...[
                const SizedBox(height: 20),
                const Text(
                  'ABOUT THIS PROGRAM',
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
                    program.description!,
                    style: const TextStyle(
                      color: kColorTextSecondary,
                      fontSize: 14,
                      height: 1.6,
                    ),
                  ),
                ),
              ],

              if (program.activeBatches.isNotEmpty) ...[
                const SizedBox(height: 20),
                const Text(
                  'ACTIVE BATCHES',
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                    color: kColorTextMuted,
                  ),
                ),
                const SizedBox(height: 8),
                ...program.activeBatches.map(
                  (b) => _BatchTile(name: b['name'] ?? ''),
                ),
              ],

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  Color get _color {
    switch (status) {
      case 'active':
        return const Color(0xFF16a34a);
      case 'inactive':
        return kColorTextMuted;
      case 'draft':
        return const Color(0xFFd97706);
      default:
        return kColorTextMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(5),
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

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kColorBorderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: kColorAccent),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              color: kColorTextPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontFamily: 'Rajdhani',
              color: kColorTextMuted,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}

class _BatchTile extends StatelessWidget {
  const _BatchTile({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kColorBorderCard),
      ),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: kColorAccent,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              name,
              style: const TextStyle(
                color: kColorTextSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const Icon(Icons.check_circle_outline,
              size: 14, color: Color(0xFF16a34a)),
        ],
      ),
    );
  }
}
