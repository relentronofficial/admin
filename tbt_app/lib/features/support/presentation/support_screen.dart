import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../domain/support_models.dart';
import '../providers/support_providers.dart';

/// Support Center landing — hero banner + quick actions + topic chips
/// + FAQs + recent tickets, matching the co-worker's layout.
///
/// Bottom sheets for Call Us and FAQ answers keep the flow inline;
/// Raise Ticket, Feedback, and View All Tickets push to the existing
/// dedicated screens.
///
/// The [focusFaqId] deep-link (fed by a notification tap or the
/// `?faqId=...` router param) scrolls the target FAQ into view and
/// pre-opens its answer sheet.
class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key, this.focusFaqId});
  final String? focusFaqId;

  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen> {
  final GlobalKey _focusedFaqKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    if (widget.focusFaqId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        // Give the FAQ list network round-trip a chance to complete
        // before we look for the target key.
        await Future<void>.delayed(const Duration(milliseconds: 500));
        if (!mounted) return;
        final ctx = _focusedFaqKey.currentContext;
        if (ctx != null) {
          await Scrollable.ensureVisible(
            ctx,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOutCubic,
            alignment: 0.15,
          );
          // Also auto-open the answer sheet so the notification lands
          // on the actual content, not just a highlighted card.
          if (!mounted) return;
          final ext = await ref.read(faqByIdProvider(widget.focusFaqId!).future);
          if (ext != null && mounted) _openFaqSheet(ext);
        }
      });
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(helpdeskSettingsProvider);
    ref.invalidate(supportCategoriesProvider);
    ref.invalidate(faqsProvider);
    ref.invalidate(myTicketsProvider);
  }

  Future<void> _launchTel(String number) async {
    final uri = Uri(scheme: 'tel', path: number);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _launchWhatsapp(String number) async {
    // Strip everything except digits so `+91 94444 88888` still opens.
    final clean = number.replaceAll(RegExp(r'[^\d]'), '');
    final uri = Uri.parse('https://wa.me/$clean');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _openCallUsSheet(HelpdeskSettings? settings) {
    final tokens = context.tokens;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    'Contact Support',
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if ((settings?.supportTiming ?? '').isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      settings!.supportTiming!,
                      style: TextStyle(color: tokens.textMuted, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            if ((settings?.phoneNumber ?? '').isNotEmpty)
              ListTile(
                leading: const Icon(Icons.phone_rounded, color: Color(0xFF27AE60)),
                title: Text('Call Helpline',
                    style: TextStyle(color: tokens.textPrimary)),
                subtitle: Text(settings!.phoneNumber!,
                    style: TextStyle(color: tokens.textMuted)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _launchTel(settings.phoneNumber!);
                },
              ),
            if ((settings?.phoneNumber ?? '').isNotEmpty &&
                (settings?.whatsappNumber ?? '').isNotEmpty)
              Divider(color: tokens.borderCard, height: 1),
            if ((settings?.whatsappNumber ?? '').isNotEmpty)
              ListTile(
                leading: const Icon(Icons.chat_rounded, color: Color(0xFF25D366)),
                title: Text('Chat on WhatsApp',
                    style: TextStyle(color: tokens.textPrimary)),
                subtitle: Text(settings!.whatsappNumber!,
                    style: TextStyle(color: tokens.textMuted)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _launchWhatsapp(settings.whatsappNumber!);
                },
              ),
            if ((settings?.email ?? '').isNotEmpty)
              ListTile(
                leading: Icon(Icons.email_rounded, color: kColorAccent),
                title: Text('Email us',
                    style: TextStyle(color: tokens.textPrimary)),
                subtitle: Text(settings!.email!,
                    style: TextStyle(color: tokens.textMuted)),
                onTap: () async {
                  Navigator.of(ctx).pop();
                  final uri = Uri(scheme: 'mailto', path: settings.email);
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri);
                  }
                },
              ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  void _openFaqSheet(Faq faq) {
    final tokens = context.tokens;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.bgSurface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: tokens.borderCard,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                faq.question,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                faq.answer,
                style: TextStyle(
                  color: tokens.textSecondary,
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  IconData _mapCategoryIcon(String name) {
    final n = name.toLowerCase();
    if (n.contains('payment') || n.contains('bill') || n.contains('subscription')) {
      return Icons.account_balance_wallet_outlined;
    }
    if (n.contains('tech') || n.contains('login') || n.contains('lag') ||
        n.contains('record') || n.contains('video')) {
      return Icons.play_circle_outline_rounded;
    }
    if (n.contains('comm') || n.contains('group') || n.contains('rule') ||
        n.contains('spam') || n.contains('abuse')) {
      return Icons.groups_outlined;
    }
    return Icons.help_outline_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final settings = ref.watch(helpdeskSettingsProvider).valueOrNull;

    return Scaffold(
      backgroundColor: tokens.bgPage,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: kColorAccent,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(child: _Header(settings: settings)),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                sliver: SliverList.list(
                  children: [
                    _HeroBanner(settings: settings),
                    const SizedBox(height: 28),
                    _SectionLabel(text: 'QUICK ACTIONS'),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _QuickTile(
                            icon: Icons.confirmation_num_outlined,
                            label: 'Raise Ticket',
                            onTap: () => context.push(AppRoutes.supportContact),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _QuickTile(
                            icon: Icons.phone_in_talk_outlined,
                            label: 'Call Us',
                            onTap: () => _openCallUsSheet(settings),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _QuickTile(
                            icon: Icons.rate_review_outlined,
                            label: 'Feedback',
                            onTap: () => context.push(AppRoutes.supportFeedback),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    _SectionLabel(text: 'BROWSE HELP TOPICS'),
                    const SizedBox(height: 12),
                    const _CategoryChipsRow(),
                    const SizedBox(height: 16),
                    _FaqList(
                      focusFaqId: widget.focusFaqId,
                      focusedFaqKey: _focusedFaqKey,
                      onTap: _openFaqSheet,
                      mapIcon: _mapCategoryIcon,
                    ),
                    const SizedBox(height: 28),
                    _RecentTicketsHeader(
                      onViewAll: () => context.push(AppRoutes.supportMyTickets),
                    ),
                    const SizedBox(height: 12),
                    const _RecentTicketsList(),
                    const SizedBox(height: 24),
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

// ── Header ─────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({required this.settings});
  final HelpdeskSettings? settings;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back, color: tokens.textPrimary),
            onPressed: () {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              } else {
                context.go(AppRoutes.dashboard);
              }
            },
          ),
          const SizedBox(width: 4),
          Text(
            settings?.title ?? 'Support Center',
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.4,
            ),
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

// ── Hero banner ────────────────────────────────────────────────────

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({required this.settings});
  final HelpdeskSettings? settings;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final subtitle = settings?.subtitle;
    return Container(
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.borderCard),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            child: Container(color: kColorAccent),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 16, 22),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        subtitle == null || subtitle.isEmpty
                            ? 'How can we help\nyou?'
                            : subtitle,
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          height: 1.25,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _OnlinePill(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnlinePill extends StatelessWidget {
  const _OnlinePill();
  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF27AE60);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: green.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: green.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          _PulseDot(),
          SizedBox(width: 6),
          Text(
            'SUPPORT\nONLINE',
            style: TextStyle(
              color: green,
              fontSize: 9,
              fontWeight: FontWeight.bold,
              height: 1.1,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot();
  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctl;

  @override
  void initState() {
    super.initState();
    _ctl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctl,
      builder: (_, __) {
        final t = _ctl.value; // 0..1
        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: const Color(0xFF27AE60),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF27AE60).withValues(alpha: 0.4 * (1 - t)),
                blurRadius: 6 + 8 * t,
                spreadRadius: 1 + 3 * t,
              ),
            ],
          ),
        );
      },
    );
  }
}

// ── Section label ──────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: Color(0xFFFFB088),
        fontSize: 11.5,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.0,
      ),
    );
  }
}

// ── Quick action tile ──────────────────────────────────────────────

class _QuickTile extends StatelessWidget {
  const _QuickTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: tokens.borderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: kColorAccent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kColorAccent.withValues(alpha: 0.25)),
              ),
              child: Icon(icon, color: kColorAccent, size: 22),
            ),
            const SizedBox(height: 18),
            Text(
              label,
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Category chips ─────────────────────────────────────────────────

class _CategoryChipsRow extends ConsumerWidget {
  const _CategoryChipsRow();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final cats = ref.watch(supportCategoriesProvider).valueOrNull ?? const [];
    final selected = ref.watch(selectedFaqCategoryProvider);

    if (cats.isEmpty) return const SizedBox.shrink();

    // Include an "All" pill so users can browse everything.
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          _Chip(
            label: 'All',
            selected: selected == null,
            onTap: () =>
                ref.read(selectedFaqCategoryProvider.notifier).state = null,
            tokens: tokens,
          ),
          for (final c in cats) ...[
            _Chip(
              label: c.name,
              selected: selected == c.id,
              onTap: () =>
                  ref.read(selectedFaqCategoryProvider.notifier).state = c.id,
              tokens: tokens,
            ),
          ],
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.tokens,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final ThemeTokens tokens;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? kColorAccent : tokens.borderCard,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? tokens.textPrimary : tokens.textSecondary,
            fontSize: 13,
            fontWeight: selected ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// ── FAQ list ───────────────────────────────────────────────────────

class _FaqList extends ConsumerWidget {
  const _FaqList({
    required this.focusFaqId,
    required this.focusedFaqKey,
    required this.onTap,
    required this.mapIcon,
  });
  final String? focusFaqId;
  final GlobalKey focusedFaqKey;
  final void Function(Faq faq) onTap;
  final IconData Function(String) mapIcon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final faqs = ref.watch(faqsProvider);
    return faqs.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator(color: kColorAccent)),
      ),
      error: (_, __) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: Text('Could not load FAQs.',
              style: TextStyle(color: tokens.textSecondary)),
        ),
      ),
      data: (list) {
        // Merge the deep-linked FAQ if it isn't in the current filter view.
        var display = list;
        if (focusFaqId != null && !list.any((f) => f.id == focusFaqId)) {
          final extra = ref.watch(faqByIdProvider(focusFaqId!)).asData?.value;
          if (extra != null) display = [extra, ...list];
        }
        if (display.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: Text('No FAQs available in this topic yet.',
                  style: TextStyle(color: tokens.textSecondary)),
            ),
          );
        }
        return Column(
          children: [
            for (final f in display)
              _FaqRow(
                key: f.id == focusFaqId ? focusedFaqKey : null,
                faq: f,
                icon: mapIcon(f.category?.name ?? ''),
                highlight: f.id == focusFaqId,
                onTap: () => onTap(f),
              ),
          ],
        );
      },
    );
  }
}

class _FaqRow extends StatelessWidget {
  const _FaqRow({
    super.key,
    required this.faq,
    required this.icon,
    required this.highlight,
    required this.onTap,
  });
  final Faq faq;
  final IconData icon;
  final bool highlight;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: highlight ? kColorAccent : tokens.borderCard,
            width: highlight ? 1.5 : 1,
          ),
          boxShadow: highlight
              ? [
                  BoxShadow(
                    color: kColorAccent.withValues(alpha: 0.18),
                    blurRadius: 12,
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Icon(icon, color: kColorAccent, size: 20),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                faq.question,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded,
                color: tokens.textMuted, size: 14),
          ],
        ),
      ),
    );
  }
}

// ── Recent tickets ─────────────────────────────────────────────────

class _RecentTicketsHeader extends StatelessWidget {
  const _RecentTicketsHeader({required this.onViewAll});
  final VoidCallback onViewAll;
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _SectionLabel(text: 'MY RECENT TICKETS'),
        GestureDetector(
          onTap: onViewAll,
          child: Text(
            'VIEW ALL',
            style: TextStyle(
              color: kColorAccent,
              fontSize: 11.5,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }
}

class _RecentTicketsList extends ConsumerWidget {
  const _RecentTicketsList();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(myTicketsProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: tokens.bgSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: tokens.borderCard),
            ),
            child: Center(
              child: Text(
                'No tickets yet — raise one when you need help.',
                style: TextStyle(color: tokens.textSecondary, fontSize: 13),
              ),
            ),
          );
        }
        final preview = list.take(3).toList();
        return Column(
          children: [
            for (final t in preview)
              _TicketPreviewCard(ticket: t),
          ],
        );
      },
    );
  }
}

class _TicketPreviewCard extends StatelessWidget {
  const _TicketPreviewCard({required this.ticket});
  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return GestureDetector(
      onTap: () => context.push(AppRoutes.supportMyTickets),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: tokens.borderCard),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: tokens.bgInput,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.description_outlined,
                  color: tokens.textSecondary, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ticket.subject,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    DateFormat.MMMd().add_jm().format(ticket.createdAt),
                    style: TextStyle(color: tokens.textMuted, fontSize: 11.5),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _StatusPill(status: ticket.status),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final map = {
      'new': (const Color(0xFF60A5FA), 'New'),
      'in_progress': (const Color(0xFFFACC15), 'In Progress'),
      'resolved': (const Color(0xFF4ADE80), 'Resolved'),
      'closed': (const Color(0xFFA0A0A0), 'Closed'),
    };
    final (color, label) = map[status] ?? (const Color(0xFFA0A0A0), status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
