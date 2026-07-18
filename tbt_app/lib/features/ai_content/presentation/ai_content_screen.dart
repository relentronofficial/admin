import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/ai_content_service.dart';
import '../domain/ai_models.dart';
import '../providers/ai_content_providers.dart';
import 'ai_history_screen.dart';
import 'ai_saved_content_screen.dart';

/// Content Buddy AI chat screen. Single-pane: message list on top,
/// composer at the bottom. Tap the ≡ icon to browse past
/// conversations; tap the bookmark to view saved snippets.
class AIContentScreen extends ConsumerStatefulWidget {
  const AIContentScreen({super.key});

  @override
  ConsumerState<AIContentScreen> createState() => _AIContentScreenState();
}

class _AIContentScreenState extends ConsumerState<AIContentScreen> {
  final _composerCtl = TextEditingController();
  final _scrollCtl = ScrollController();
  final _picker = ImagePicker();

  bool _sending = false;
  String? _pendingImagePath;
  Uint8List? _pendingImageBytes;

  // Draft messages kept locally so a request in flight shows an
  // optimistic bubble instantly. Cleared on refetch.
  final List<AIMessage> _optimistic = [];

  @override
  void dispose() {
    _composerCtl.dispose();
    _scrollCtl.dispose();
    super.dispose();
  }

  Future<void> _scrollToEnd() async {
    // Wait for the frame that renders the new bubble so ScrollController
    // sees an updated maxScrollExtent.
    await Future<void>.delayed(const Duration(milliseconds: 60));
    if (!_scrollCtl.hasClients) return;
    _scrollCtl.animateTo(
      _scrollCtl.position.maxScrollExtent,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  Future<void> _pickImage() async {
    try {
      final f = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 82, // ~2 MB after JPEG re-encode for typical photos
      );
      if (f == null) return;
      final bytes = await f.readAsBytes();
      setState(() {
        _pendingImagePath = f.path;
        _pendingImageBytes = bytes;
      });
    } catch (err) {
      if (!mounted) return;
      _snack('Could not open the image picker.');
    }
  }

  void _clearImage() {
    setState(() {
      _pendingImagePath = null;
      _pendingImageBytes = null;
    });
  }

  Future<void> _send() async {
    final text = _composerCtl.text.trim();
    if (text.isEmpty && _pendingImageBytes == null) return;
    if (_sending) return;

    final conversationId = ref.read(activeConversationIdProvider);
    final message = text.isEmpty ? 'Describe this image.' : text;
    final imageBytes = _pendingImageBytes;
    final now = DateTime.now();

    setState(() {
      _sending = true;
      // Optimistic user bubble — will be reconciled when the server
      // returns the real assistant reply and we refetch.
      _optimistic.add(AIMessage(
        id: 'local-${now.microsecondsSinceEpoch}',
        conversationId: conversationId ?? '',
        sender: 'user',
        message: message,
        inputType: imageBytes != null ? 'image' : 'text',
        createdAt: now,
        imageUrl: null,
      ));
      _composerCtl.clear();
    });
    _scrollToEnd();

    try {
      final result = await ref.read(aiContentServiceProvider).generate(
            message: message,
            conversationId: conversationId,
            imageBytes: imageBytes,
            imageMimeType: imageBytes != null ? 'image/jpeg' : null,
          );

      // Set active conversation for a fresh convo & refresh sidebar.
      if (conversationId == null) {
        ref.read(activeConversationIdProvider.notifier).state = result.conversationId;
      }
      ref.invalidate(aiConversationsProvider);
      ref.invalidate(aiMessagesProvider(result.conversationId));

      if (mounted) {
        setState(() {
          _optimistic.clear();
          _pendingImagePath = null;
          _pendingImageBytes = null;
        });
      }
      _scrollToEnd();
    } catch (err) {
      if (!mounted) return;
      setState(() {
        // Drop the optimistic bubble so the user isn't left staring at
        // a phantom message.
        _optimistic.removeWhere((m) => m.id.startsWith('local-'));
      });
      _snack(_friendlyError(err));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  String _friendlyError(Object err) {
    final s = err.toString();
    if (s.contains('daily_limit_reached')) {
      return 'Daily limit reached — try again tomorrow.';
    }
    if (s.contains('rate_limited')) {
      return 'Slow down — max 10 messages per minute.';
    }
    if (s.contains('claude_timeout')) {
      return 'The AI is slow to respond. Please try again.';
    }
    if (s.contains('image_too_large')) {
      return 'Image is too large — try a smaller one.';
    }
    if (s.contains('claude_not_configured')) {
      return 'AI is not available right now.';
    }
    return 'Something went wrong. Please try again.';
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: kColorBgModal,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _startNewConversation() async {
    ref.read(activeConversationIdProvider.notifier).state = null;
    setState(() => _optimistic.clear());
    _composerCtl.clear();
    _clearImage();
  }

  Future<void> _openHistory() async {
    final chosen = await Navigator.of(context).push<String?>(
      MaterialPageRoute(builder: (_) => const AIHistoryScreen()),
    );
    if (chosen != null && mounted) {
      ref.read(activeConversationIdProvider.notifier).state = chosen;
      setState(() => _optimistic.clear());
    }
  }

  Future<void> _openSaved() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const AISavedContentScreen()),
    );
  }

  Future<void> _saveMessage(AIMessage m) async {
    final titleCtl = TextEditingController(
      text: m.message.split('\n').first.substring(0, m.message.length.clamp(0, 60)),
    );
    String category = 'social_media';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: kColorBgModal,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Save snippet',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              TextField(
                controller: titleCtl,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDeco('Title'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: category,
                dropdownColor: kColorBgModal,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDeco('Category'),
                items: kSavedCategories
                    .map((c) => DropdownMenuItem(value: c, child: Text(prettyCategory(c))))
                    .toList(),
                onChanged: (v) => setModal(() => category = v ?? 'other'),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(
                  backgroundColor: kColorAccent,
                  minimumSize: const Size.fromHeight(44),
                ),
                child: const Text('SAVE'),
              ),
            ],
          ),
        ),
      ),
    );
    if (ok == true) {
      try {
        await ref.read(aiContentServiceProvider).saveContent(
              title: titleCtl.text.trim().isEmpty ? 'Untitled' : titleCtl.text.trim(),
              content: m.message,
              category: category,
              conversationId: m.conversationId.isEmpty ? null : m.conversationId,
            );
        ref.invalidate(savedContentProvider);
        if (mounted) _snack('Saved to your library.');
      } catch (_) {
        if (mounted) _snack('Save failed.');
      }
    }
  }

  InputDecoration _inputDeco(String label) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Color(0xFF888888)),
        filled: true,
        fillColor: kColorBgInput,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kColorBorderInput),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kColorBorderInput),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kColorAccent),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final activeId = ref.watch(activeConversationIdProvider);

    // Combine server messages + local optimistic bubbles.
    final serverMessages = activeId == null
        ? const AsyncValue<List<AIMessage>>.data([])
        : ref.watch(aiMessagesProvider(activeId));

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text(
          'Content Buddy AI',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'History',
            onPressed: _openHistory,
            icon: const Icon(Icons.forum_outlined, color: Colors.white),
          ),
          IconButton(
            tooltip: 'Saved',
            onPressed: _openSaved,
            icon: const Icon(Icons.bookmark_border, color: Colors.white),
          ),
          IconButton(
            tooltip: 'New chat',
            onPressed: _sending ? null : _startNewConversation,
            icon: const Icon(Icons.add_circle_outline, color: Colors.white),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: serverMessages.when(
              loading: () => const Center(child: CircularProgressIndicator(color: kColorAccent)),
              error: (err, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    _friendlyError(err),
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.textSecondary, fontSize: 13),
                  ),
                ),
              ),
              data: (msgs) {
                final all = [...msgs, ..._optimistic];
                if (all.isEmpty) {
                  return _EmptyState(
                    onSuggest: (prompt) {
                      _composerCtl.text = prompt;
                      _composerCtl.selection = TextSelection.collapsed(offset: prompt.length);
                    },
                  );
                }
                return ListView.builder(
                  controller: _scrollCtl,
                  padding: const EdgeInsets.all(12),
                  itemCount: all.length + (_sending ? 1 : 0),
                  itemBuilder: (ctx, i) {
                    if (i == all.length && _sending) {
                      return const _TypingIndicator();
                    }
                    return _MessageBubble(
                      message: all[i],
                      onSave: all[i].sender == 'assistant' && !all[i].id.startsWith('local-')
                          ? () => _saveMessage(all[i])
                          : null,
                    );
                  },
                );
              },
            ),
          ),
          _Composer(
            controller: _composerCtl,
            pendingImagePath: _pendingImagePath,
            pendingImageBytes: _pendingImageBytes,
            onPickImage: _pickImage,
            onClearImage: _clearImage,
            onSend: _send,
            sending: _sending,
          ),
        ],
      ),
    );
  }
}

// ── Bubble ────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, this.onSave});
  final AIMessage message;
  final VoidCallback? onSave;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isUser = message.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isUser ? kColorAccent : tokens.bgSurface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(14),
              topRight: const Radius.circular(14),
              bottomLeft: Radius.circular(isUser ? 14 : 4),
              bottomRight: Radius.circular(isUser ? 4 : 14),
            ),
            border: Border.all(color: isUser ? Colors.transparent : tokens.borderCard),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (message.imageUrl != null && message.imageUrl!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      message.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                ),
              SelectableText(
                message.message,
                style: TextStyle(
                  color: isUser ? Colors.white : tokens.textPrimary,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
              if (onSave != null || !isUser)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _BubbleAction(
                        icon: Icons.copy_outlined,
                        label: 'Copy',
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: message.message));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Copied'),
                              duration: Duration(seconds: 1),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                      ),
                      if (onSave != null) ...[
                        const SizedBox(width: 12),
                        _BubbleAction(
                          icon: Icons.bookmark_add_outlined,
                          label: 'Save',
                          onTap: onSave!,
                        ),
                      ],
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

class _BubbleAction extends StatelessWidget {
  const _BubbleAction({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: tokens.textSecondary),
            const SizedBox(width: 4),
            Text(label,
                style: TextStyle(
                  color: tokens.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                )),
          ],
        ),
      ),
    );
  }
}

// ── Composer ──────────────────────────────────────────────────────

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.pendingImagePath,
    required this.pendingImageBytes,
    required this.onPickImage,
    required this.onClearImage,
    required this.onSend,
    required this.sending,
  });
  final TextEditingController controller;
  final String? pendingImagePath;
  final Uint8List? pendingImageBytes;
  final VoidCallback onPickImage;
  final VoidCallback onClearImage;
  final VoidCallback onSend;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          border: Border(top: BorderSide(color: tokens.borderCard)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (pendingImageBytes != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.memory(
                        pendingImageBytes!,
                        width: 60,
                        height: 60,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Image attached',
                        style: TextStyle(color: tokens.textSecondary, fontSize: 12),
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close, size: 18, color: tokens.textSecondary),
                      onPressed: onClearImage,
                    ),
                  ],
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: sending ? null : onPickImage,
                  icon: Icon(Icons.image_outlined, color: tokens.textSecondary),
                  tooltip: 'Add image',
                ),
                Expanded(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 44, maxHeight: 140),
                    child: TextField(
                      controller: controller,
                      style: TextStyle(color: tokens.textPrimary, fontSize: 14),
                      maxLines: null,
                      textInputAction: TextInputAction.newline,
                      decoration: InputDecoration(
                        hintText: 'Ask Content Buddy…',
                        hintStyle: TextStyle(color: tokens.textMuted, fontSize: 14),
                        filled: true,
                        fillColor: tokens.bgInput,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide(color: tokens.borderInput),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide(color: tokens.borderInput),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: const BorderSide(color: kColorAccent),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  onPressed: sending ? null : onSend,
                  icon: sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: kColorAccent),
                        )
                      : const Icon(Icons.send, color: kColorAccent),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Typing indicator ──────────────────────────────────────────────

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(14),
            topRight: Radius.circular(14),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(14),
          ),
          border: Border.all(color: tokens.borderCard),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Dot(delay: 0),
            SizedBox(width: 4),
            _Dot(delay: 120),
            SizedBox(width: 4),
            _Dot(delay: 240),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatefulWidget {
  const _Dot({required this.delay});
  final int delay;
  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _c.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.3, end: 1.0).animate(_c),
      child: Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(color: kColorAccent, shape: BoxShape.circle),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onSuggest});
  final void Function(String) onSuggest;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final suggestions = [
      'Write an Instagram caption for my new business launch.',
      'Draft a WhatsApp message to invite people to my workshop.',
      'Give me 5 ideas for a short video script about my product.',
      'Write a professional email offering my consulting service.',
    ];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 32),
          Center(
            child: Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: kColorAccent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.auto_awesome, size: 32, color: kColorAccent),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Meet Content Buddy',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Your AI writing partner. Ask for a caption, a script, an email — anything.',
            textAlign: TextAlign.center,
            style: TextStyle(color: tokens.textSecondary, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 24),
          ...suggestions.map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => onSuggest(s),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: tokens.bgSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: tokens.borderCard),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 14, color: kColorAccent),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(s,
                            style: TextStyle(color: tokens.textPrimary, fontSize: 13)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
