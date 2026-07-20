import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../providers/support_providers.dart';

/// Support landing screen. Contact channels + FAQ browser +
/// entry points for ticket submission and feedback.
class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});
  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen> {
  final _searchCtl = TextEditingController();

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final settings = ref.watch(helpdeskSettingsProvider);
    final categories = ref.watch(supportCategoriesProvider);
    final selectedCategory = ref.watch(selectedFaqCategoryProvider);
    final faqs = ref.watch(faqsProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: settings.when(
          loading: () => const Text('Support',
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
          error: (_, __) => const Text('Support',
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
          data: (s) => Text(
            s?.title ?? 'Support',
            style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'My tickets',
            icon: const Icon(Icons.receipt_long, color: Colors.white),
            onPressed: () => GoRouter.of(context).push(AppRoutes.supportMyTickets),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(helpdeskSettingsProvider);
          ref.invalidate(supportCategoriesProvider);
          ref.invalidate(faqsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: [
            // ── Subtitle + banner ───────────────────────────────────
            settings.maybeWhen(
              data: (s) => s == null
                  ? const SizedBox.shrink()
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Text(
                        s.subtitle ?? 'We are here to help.',
                        style: TextStyle(color: tokens.textSecondary, fontSize: 13, height: 1.5),
                      ),
                    ),
              orElse: () => const SizedBox.shrink(),
            ),

            // ── Contact channels ────────────────────────────────────
            settings.maybeWhen(
              data: (s) {
                if (s == null) return const SizedBox.shrink();
                final channels = <_ChannelData>[
                  if (s.whatsappNumber != null && s.whatsappNumber!.isNotEmpty)
                    _ChannelData(
                      icon: Icons.chat,
                      label: 'WhatsApp',
                      value: s.whatsappNumber!,
                      onTap: () => _openUrl(
                          'https://wa.me/${s.whatsappNumber!.replaceAll(RegExp(r'\D'), '')}'),
                    ),
                  if (s.phoneNumber != null && s.phoneNumber!.isNotEmpty)
                    _ChannelData(
                      icon: Icons.call,
                      label: 'Call',
                      value: s.phoneNumber!,
                      onTap: () => _openUrl('tel:${s.phoneNumber}'),
                    ),
                  if (s.email != null && s.email!.isNotEmpty)
                    _ChannelData(
                      icon: Icons.email_outlined,
                      label: 'Email',
                      value: s.email!,
                      onTap: () => _openUrl('mailto:${s.email}'),
                    ),
                ];
                if (channels.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                  child: Row(
                    children: channels
                        .map((c) => Expanded(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                child: _ChannelTile(data: c),
                              ),
                            ))
                        .toList(),
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),

            const SizedBox(height: 16),

            // ── Action buttons ──────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () =>
                          GoRouter.of(context).push(AppRoutes.supportContact),
                      icon: const Icon(Icons.mail_outline, size: 18),
                      label: const Text('CONTACT US'),
                      style: FilledButton.styleFrom(
                        backgroundColor: kColorAccent,
                        minimumSize: const Size.fromHeight(44),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          GoRouter.of(context).push(AppRoutes.supportFeedback),
                      icon: Icon(Icons.rate_review_outlined, size: 18, color: tokens.textPrimary),
                      label: Text('FEEDBACK',
                          style: TextStyle(color: tokens.textPrimary)),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: tokens.borderCard),
                        minimumSize: const Size.fromHeight(44),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ── FAQ search ──────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Text(
                'FAQs',
                style: TextStyle(
                  color: tokens.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: TextField(
                controller: _searchCtl,
                onChanged: (v) => ref.read(faqSearchProvider.notifier).state = v.trim(),
                style: TextStyle(color: tokens.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search FAQs…',
                  hintStyle: TextStyle(color: tokens.textMuted, fontSize: 14),
                  prefixIcon: Icon(Icons.search, size: 18, color: tokens.textSecondary),
                  filled: true,
                  fillColor: tokens.bgInput,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: tokens.borderInput),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: tokens.borderInput),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: kColorAccent),
                  ),
                ),
              ),
            ),

            // ── Category chips ──────────────────────────────────────
            categories.maybeWhen(
              data: (cats) => cats.isEmpty
                  ? const SizedBox.shrink()
                  : SizedBox(
                      height: 34,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        children: [
                          _CategoryChip(
                            label: 'All',
                            selected: selectedCategory == null,
                            onTap: () => ref
                                .read(selectedFaqCategoryProvider.notifier)
                                .state = null,
                          ),
                          ...cats.map(
                            (c) => _CategoryChip(
                              label: c.name,
                              selected: selectedCategory == c.id,
                              onTap: () => ref
                                  .read(selectedFaqCategoryProvider.notifier)
                                  .state = c.id,
                            ),
                          ),
                        ],
                      ),
                    ),
              orElse: () => const SizedBox.shrink(),
            ),

            const SizedBox(height: 12),

            // ── FAQ list ────────────────────────────────────────────
            faqs.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator(color: kColorAccent)),
              ),
              error: (_, __) => Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text('Could not load FAQs.',
                      style: TextStyle(color: tokens.textSecondary)),
                ),
              ),
              data: (list) {
                if (list.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(32),
                    child: Center(
                      child: Text(
                        'No FAQs match.',
                        style: TextStyle(color: tokens.textSecondary),
                      ),
                    ),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: list.map((f) => _FaqTile(faq: f)).toList(),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ChannelData {
  const _ChannelData({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;
}

class _ChannelTile extends StatelessWidget {
  const _ChannelTile({required this.data});
  final _ChannelData data;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Material(
      color: tokens.bgSurface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: data.onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
          child: Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: kColorAccent.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(data.icon, color: kColorAccent, size: 18),
              ),
              const SizedBox(height: 6),
              Text(
                data.label,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : const Color(0xFFa0a0a0),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        selected: selected,
        onSelected: (_) => onTap(),
        backgroundColor: kColorBgSurface,
        selectedColor: kColorAccent,
        side: BorderSide(color: selected ? kColorAccent : kColorBorderCard),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  const _FaqTile({required this.faq});
  final dynamic faq;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(
          dividerColor: Colors.transparent,
          expansionTileTheme: const ExpansionTileThemeData(iconColor: kColorAccent),
        ),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 12),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          title: Text(
            faq.question,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              height: 1.3,
            ),
          ),
          children: [
            Text(
              faq.answer,
              style: TextStyle(color: tokens.textSecondary, fontSize: 13, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
