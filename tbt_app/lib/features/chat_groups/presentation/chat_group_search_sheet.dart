import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/chat_groups_service.dart';
import '../domain/chat_group_models.dart';

class ChatGroupSearchSheet extends ConsumerStatefulWidget {
  const ChatGroupSearchSheet({
    super.key,
    required this.groupId,
    required this.onJumpToMessage,
  });
  final String groupId;
  final void Function(String messageId) onJumpToMessage;

  @override
  ConsumerState<ChatGroupSearchSheet> createState() => _ChatGroupSearchSheetState();
}

class _ChatGroupSearchSheetState extends ConsumerState<ChatGroupSearchSheet> {
  final _ctl = TextEditingController();
  Timer? _debounce;
  List<ChatGroupMessage> _results = const [];
  bool _searching = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _ctl.dispose();
    super.dispose();
  }

  void _onChange(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      if (v.trim().length < 2) {
        setState(() {
          _results = const [];
          _searching = false;
        });
        return;
      }
      setState(() => _searching = true);
      try {
        final res = await ref
            .read(chatGroupsServiceProvider)
            .search(widget.groupId, v);
        if (!mounted) return;
        setState(() {
          _results = res;
          _searching = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => _searching = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtl) => Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: tokens.borderCard, borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _ctl,
                autofocus: true,
                onChanged: _onChange,
                style: TextStyle(color: tokens.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search messages in this group…',
                  hintStyle: TextStyle(color: tokens.textMuted),
                  prefixIcon: Icon(Icons.search_rounded, color: tokens.textMuted),
                  filled: true,
                  fillColor: tokens.bgInput,
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
              child: _searching
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : _results.isEmpty
                      ? Center(
                          child: Text(
                            _ctl.text.trim().length < 2
                                ? 'Type at least 2 characters.'
                                : 'No matches.',
                            style: TextStyle(color: tokens.textMuted, fontSize: 12),
                          ),
                        )
                      : ListView.separated(
                          controller: scrollCtl,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          itemCount: _results.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 6),
                          itemBuilder: (_, i) {
                            final m = _results[i];
                            final when = DateFormat.MMMd().add_jm().format(m.createdAt.toLocal());
                            final name = m.sender?.displayName ?? 'Member';
                            return Material(
                              color: tokens.bgInput,
                              borderRadius: BorderRadius.circular(10),
                              child: InkWell(
                                onTap: () => widget.onJumpToMessage(m.id),
                                borderRadius: BorderRadius.circular(10),
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(name, style: const TextStyle(color: kColorAccent, fontSize: 11, fontWeight: FontWeight.w700)),
                                          const SizedBox(width: 6),
                                          Text('· $when', style: TextStyle(color: tokens.textMuted, fontSize: 10)),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        m.body ?? (m.mediaType != null ? '📎 ${m.mediaType}' : '…'),
                                        style: TextStyle(color: tokens.textPrimary, fontSize: 13, height: 1.35),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
