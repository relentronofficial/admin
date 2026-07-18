import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/ai_content_service.dart';
import '../providers/ai_content_providers.dart';

/// Past AI conversations. Tap one → pops with the conversation id so
/// the chat screen switches to it. Long-press → rename or delete.
class AIHistoryScreen extends ConsumerStatefulWidget {
  const AIHistoryScreen({super.key});

  @override
  ConsumerState<AIHistoryScreen> createState() => _AIHistoryScreenState();
}

class _AIHistoryScreenState extends ConsumerState<AIHistoryScreen> {
  final _searchCtl = TextEditingController();

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(aiConversationsProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('Chat history', style: TextStyle(color: Colors.white, fontSize: 17)),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: TextField(
              controller: _searchCtl,
              onChanged: (v) =>
                  ref.read(aiConversationsSearchProvider.notifier).state = v.trim(),
              style: TextStyle(color: tokens.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search conversations…',
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
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator(color: kColorAccent)),
              error: (e, _) => Center(
                child: Text('Could not load history.',
                    style: TextStyle(color: tokens.textSecondary)),
              ),
              data: (list) {
                if (list.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'No conversations yet.\nStart chatting to see them here.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: tokens.textSecondary, height: 1.5),
                      ),
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(aiConversationsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (ctx, i) {
                      final c = list[i];
                      return Material(
                        color: tokens.bgSurface,
                        borderRadius: BorderRadius.circular(10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () => Navigator.pop(context, c.id),
                          onLongPress: () => _showActions(context, c.id, c.title),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: kColorAccent.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.forum_outlined,
                                      color: kColorAccent, size: 18),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        c.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: tokens.textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        DateFormat.yMMMd().add_jm().format(c.updatedAt),
                                        style: TextStyle(
                                          color: tokens.textMuted,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Icon(Icons.chevron_right,
                                    color: tokens.textMuted, size: 20),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showActions(BuildContext ctx, String id, String title) async {
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
      final ctl = TextEditingController(text: title);
      final ok = await showDialog<bool>(
        context: ctx,
        builder: (_) => AlertDialog(
          backgroundColor: kColorBgModal,
          title: const Text('Rename', style: TextStyle(color: Colors.white)),
          content: TextField(
            controller: ctl,
            autofocus: true,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(hintText: 'Conversation title'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      );
      if (ok == true && ctl.text.trim().isNotEmpty) {
        await ref.read(aiContentServiceProvider).renameConversation(id, ctl.text.trim());
        ref.invalidate(aiConversationsProvider);
      }
    } else if (choice == 'delete') {
      if (!ctx.mounted) return;
      final ok = await showDialog<bool>(
        context: ctx,
        builder: (_) => AlertDialog(
          backgroundColor: kColorBgModal,
          title: const Text('Delete conversation?', style: TextStyle(color: Colors.white)),
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
        await ref.read(aiContentServiceProvider).deleteConversation(id);
        ref.invalidate(aiConversationsProvider);
        // If we deleted the active conversation, clear the pointer so
        // the chat screen resets to a fresh state.
        if (ref.read(activeConversationIdProvider) == id) {
          ref.read(activeConversationIdProvider.notifier).state = null;
        }
      }
    }
  }
}
