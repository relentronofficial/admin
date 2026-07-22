import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../data/programs_service.dart';
import '../providers/programs_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_loader.dart';
class ProgramsScreen extends ConsumerWidget {
  const ProgramsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(programsProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          'PROGRAMS',
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
            onPressed: () => ref.invalidate(programsProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () =>
            const AppLoader.center(),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load programs',
                  style: TextStyle(color: context.tokens.textSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(programsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (programs) {
          if (programs.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.school_outlined, color: context.tokens.textMuted, size: 40),
                  SizedBox(height: 12),
                  Text('No programs available',
                      style: TextStyle(
                          color: context.tokens.textSecondary, fontSize: 14)),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: programs.length,
            itemBuilder: (_, i) => RepaintBoundary(
              child: _ProgramCard(
                program: programs[i],
                onTap: () =>
                    context.push(AppRoutes.programDetailPath(programs[i].id)),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Program card ──────────────────────────────────────────────────────────────

class _ProgramCard extends StatelessWidget {
  const _ProgramCard({required this.program, required this.onTap});

  final TbtProgram program;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: program.name,
      button: true,
      child: GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon column
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.school_outlined,
                  color: Theme.of(context).colorScheme.primary, size: 22),
            ),
            const SizedBox(width: 12),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          program.name,
                          style: TextStyle(
                            color: context.tokens.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      _StatusChip(context, status: program.status),
                    ],
                  ),
                  if (program.description != null &&
                      program.description!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      program.description!,
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 12,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _MetaChip(
                        icon: Icons.calendar_today_outlined,
                        label: '${program.durationDays}d program',
                      ),
                      const SizedBox(width: 6),
                      _MetaChip(
                        icon: Icons.hourglass_bottom_outlined,
                        label: '${program.incubationDays}d incubation',
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(width: 4),
            Icon(Icons.chevron_right, color: context.tokens.textMuted, size: 18),
          ],
        ),
      ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(BuildContext context, {required this.status});

  final String status;

  Color _color(BuildContext context) {
    switch (status) {
      case 'active':
        return const Color(0xFF16a34a);
      case 'inactive':
        return context.tokens.textMuted;
      case 'draft':
        return const Color(0xFFd97706);
      default:
        return context.tokens.textMuted;
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

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: context.tokens.textMuted),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            color: context.tokens.textMuted,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}
