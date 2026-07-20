import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/routes.dart';
import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';

/// Home menu grid — 6 tiles in 2×3 layout matching the co-worker's
/// _buildMenuGrid (main.dart:4138). Each tile is a large glass card
/// with icon + label. Accent red, staggered animations.
///
/// Row 1: Community · Courses
/// Row 2: Podcast · Workshop
/// Row 3: E-Book · Task
class HomeMenuGrid extends StatelessWidget {
  const HomeMenuGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final items = <_MenuItem>[
      _MenuItem(
        title: 'Community',
        icon: Icons.groups_rounded,
        onTap: () {
          // We don't have a dedicated community screen; the composer on
          // the home page already lets members submit. Show a snackbar
          // note for now — future work: dedicated community feed screen.
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Community feed opens from the composer above.'),
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 2),
            ),
          );
        },
      ),
      _MenuItem(
        title: 'Courses',
        icon: Icons.school_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.courses),
      ),
      _MenuItem(
        title: 'Podcast',
        icon: Icons.podcasts_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.podcasts),
      ),
      _MenuItem(
        title: 'Workshop',
        icon: Icons.co_present_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.workshops),
      ),
      _MenuItem(
        title: 'E-Book',
        icon: Icons.menu_book_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.ebooks),
      ),
      _MenuItem(
        title: 'Task',
        icon: Icons.task_alt_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.batchProgram),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(3, (rowIdx) {
        final rowItems = items.sublist(rowIdx * 2, rowIdx * 2 + 2);
        return Padding(
          padding: EdgeInsets.only(top: rowIdx == 0 ? 0 : 14),
          child: Row(
            children: [
              for (int i = 0; i < rowItems.length; i++) ...[
                if (i > 0) const SizedBox(width: 14),
                Expanded(child: _GlassMenuCard(item: rowItems[i])),
              ],
            ],
          ),
        );
      }),
    );
  }
}

class _MenuItem {
  const _MenuItem({required this.title, required this.icon, required this.onTap});
  final String title;
  final IconData icon;
  final VoidCallback onTap;
}

class _GlassMenuCard extends StatelessWidget {
  const _GlassMenuCard({required this.item});
  final _MenuItem item;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: item.onTap,
        borderRadius: BorderRadius.circular(16),
        splashColor: kColorAccent.withValues(alpha: 0.15),
        child: Container(
          height: 100,
          decoration: BoxDecoration(
            color: tokens.bgSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: tokens.borderCard),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                kColorAccent.withValues(alpha: 0.10),
                Colors.transparent,
                Colors.transparent,
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: kColorAccent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: kColorAccent.withValues(alpha: 0.3)),
                  ),
                  child: Icon(item.icon, color: kColorAccent, size: 18),
                ),
                Text(
                  item.title,
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
