import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/ai_content_service.dart';
import '../domain/ai_models.dart';
import '../providers/ai_content_providers.dart';
import '../../../shared/widgets/app_loader.dart';

/// Library of saved AI-generated snippets. Category filter chip row on
/// top, list below. Tap → view; long-press → edit / delete.
class AISavedContentScreen extends ConsumerStatefulWidget {
  const AISavedContentScreen({super.key});

  @override
  ConsumerState<AISavedContentScreen> createState() => _AISavedContentScreenState();
}

class _AISavedContentScreenState extends ConsumerState<AISavedContentScreen> {
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final selectedCat = ref.watch(savedCategoryFilterProvider);
    final async = ref.watch(savedContentProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('Saved snippets', style: TextStyle(color: Colors.white, fontSize: 17)),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                _CategoryChip(
                  label: 'All',
                  selected: selectedCat == null,
                  onTap: () => ref.read(savedCategoryFilterProvider.notifier).state = null,
                ),
                ...kSavedCategories.map(
                  (c) => _CategoryChip(
                    label: prettyCategory(c),
                    selected: selectedCat == c,
                    onTap: () => ref.read(savedCategoryFilterProvider.notifier).state = c,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const AppLoader.center(),
              error: (e, _) => Center(
                child: Text('Could not load saved snippets.',
                    style: TextStyle(color: tokens.textSecondary)),
              ),
              data: (list) {
                if (list.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Nothing saved yet.\nTap "Save" on any AI reply to add it here.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: tokens.textSecondary, height: 1.5),
                      ),
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(savedContentProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (ctx, i) => _SavedTile(item: list[i]),
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
            fontSize: 12,
            fontWeight: FontWeight.w600,
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

class _SavedTile extends ConsumerWidget {
  const _SavedTile({required this.item});
  final SavedAIContent item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return Material(
      color: tokens.bgSurface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => _view(context, ref),
        onLongPress: () => _actions(context, ref),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: kColorAccent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      prettyCategory(item.category).toUpperCase(),
                      style: const TextStyle(
                        color: kColorAccent,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    DateFormat.yMMMd().format(item.createdAt),
                    style: TextStyle(color: tokens.textMuted, fontSize: 10),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                item.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                item.content,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: tokens.textSecondary, fontSize: 12, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _view(BuildContext ctx, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: ctx,
      backgroundColor: kColorBgModal,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.92,
        minChildSize: 0.3,
        builder: (_, ctl) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFF444444),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(item.title,
                  style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  controller: ctl,
                  child: SelectableText(
                    item.content,
                    style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: item.content));
                        ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                          content: Text('Copied'),
                          duration: Duration(seconds: 1),
                          behavior: SnackBarBehavior.floating,
                        ));
                      },
                      icon: const Icon(Icons.copy_outlined, color: Colors.white),
                      label: const Text('COPY', style: TextStyle(color: Colors.white)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF444444)),
                        minimumSize: const Size.fromHeight(44),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await Share.shareOrCopy(item.content);
                      },
                      icon: const Icon(Icons.ios_share),
                      label: const Text('SHARE'),
                      style: FilledButton.styleFrom(
                        backgroundColor: kColorAccent,
                        minimumSize: const Size.fromHeight(44),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _actions(BuildContext ctx, WidgetRef ref) async {
    final choice = await showModalBottomSheet<String>(
      context: ctx,
      backgroundColor: kColorBgModal,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: Colors.white),
              title: const Text('Rename', style: TextStyle(color: Colors.white)),
              onTap: () => Navigator.pop(ctx, 'rename'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
              title: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
              onTap: () => Navigator.pop(ctx, 'delete'),
            ),
          ],
        ),
      ),
    );
    if (!ctx.mounted) return;
    if (choice == 'rename') {
      final tCtl = TextEditingController(text: item.title);
      final ok = await showDialog<bool>(
        context: ctx,
        builder: (_) => AlertDialog(
          backgroundColor: kColorBgModal,
          title: const Text('Rename', style: TextStyle(color: Colors.white)),
          content: TextField(
            controller: tCtl,
            autofocus: true,
            style: const TextStyle(color: Colors.white),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      );
      if (ok == true && tCtl.text.trim().isNotEmpty) {
        await ref.read(aiContentServiceProvider).updateSaved(item.id, title: tCtl.text.trim());
        ref.invalidate(savedContentProvider);
      }
    } else if (choice == 'delete') {
      if (!ctx.mounted) return;
      final ok = await showDialog<bool>(
        context: ctx,
        builder: (_) => AlertDialog(
          backgroundColor: kColorBgModal,
          title: const Text('Delete snippet?', style: TextStyle(color: Colors.white)),
          content: const Text('This cannot be undone.', style: TextStyle(color: Color(0xFFBBBBBB))),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
            ),
          ],
        ),
      );
      if (ok == true) {
        await ref.read(aiContentServiceProvider).deleteSaved(item.id);
        ref.invalidate(savedContentProvider);
      }
    }
  }
}

// Small wrapper so the "Share" button degrades to Copy on platforms
// where the share sheet isn't available (e.g. some Flutter web builds).
// The app currently only ships to Android/iOS, but keeping this
// helper isolated makes it a one-line swap to add share_plus later
// without dragging the dep into pubspec right now.
abstract class Share {
  static Future<void> shareOrCopy(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
  }
}
