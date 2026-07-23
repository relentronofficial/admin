import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_loader.dart';
import '../data/support_service.dart';
import '../domain/support_models.dart';
import '../providers/support_providers.dart';

/// Full ticket conversation view — original request + interleaved
/// admin and member replies, ordered oldest-first. Sticky compose bar
/// at the bottom for follow-ups.
class SupportTicketDetailScreen extends ConsumerStatefulWidget {
  const SupportTicketDetailScreen({super.key, required this.ticketId});
  final String ticketId;

  @override
  ConsumerState<SupportTicketDetailScreen> createState() =>
      _SupportTicketDetailScreenState();
}

class _SupportTicketDetailScreenState
    extends ConsumerState<SupportTicketDetailScreen> {
  final _composeCtl = TextEditingController();
  final _scrollCtl = ScrollController();
  bool _sending = false;

  @override
  void dispose() {
    _composeCtl.dispose();
    _scrollCtl.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollCtl.hasClients) return;
      _scrollCtl.animateTo(
        _scrollCtl.position.maxScrollExtent,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send() async {
    final body = _composeCtl.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(supportServiceProvider)
          .postMemberReply(ticketId: widget.ticketId, body: body);
      _composeCtl.clear();
      // Force a refetch — the FutureProvider is autoDispose but the
      // detail screen is still mounted, so invalidate to trigger a
      // fresh fetch that pulls in the new reply row.
      ref.invalidate(ticketDetailProvider(widget.ticketId));
      ref.invalidate(myTicketsProvider);
      _scrollToBottom();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not send. Please try again.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(ticketDetailProvider(widget.ticketId));

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        iconTheme: IconThemeData(color: tokens.textPrimary),
        title: async.when(
          loading: () => Text('Ticket',
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              )),
          error: (_, __) => Text('Ticket',
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              )),
          data: (t) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                t?.displayId ?? 'Ticket',
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
              if (t != null)
                Text(
                  t.category?.name ?? 'Support',
                  style: TextStyle(
                    color: tokens.textMuted,
                    fontSize: 11,
                  ),
                ),
            ],
          ),
        ),
        actions: [
          async.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (t) => t == null
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Center(child: _StatusPill(status: t.status)),
                  ),
          ),
        ],
      ),
      body: async.when(
        loading: () => const AppLoader.center(),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Could not load ticket.',
              style: TextStyle(color: tokens.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        ),
        data: (t) {
          if (t == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'This ticket is no longer available.',
                  style: TextStyle(color: tokens.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          // Auto-scroll to bottom on first render + whenever new data
          // arrives (invalidate → refetch → data event).
          _scrollToBottom();
          final isClosed = t.status == 'closed';
          return SafeArea(
            top: false,
            child: Column(
              children: [
                Expanded(
                  child: RefreshIndicator(
                    color: kColorAccent,
                    onRefresh: () async =>
                        ref.invalidate(ticketDetailProvider(widget.ticketId)),
                    child: ListView(
                      controller: _scrollCtl,
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      children: [
                        _TicketHeaderCard(ticket: t),
                        const SizedBox(height: 16),
                        _OriginalMessageBubble(ticket: t),
                        for (final r in t.replies) ...[
                          const SizedBox(height: 12),
                          _ReplyBubble(reply: r),
                        ],
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
                _ComposeBar(
                  controller: _composeCtl,
                  sending: _sending,
                  disabled: isClosed,
                  onSend: _send,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Ticket header card ─────────────────────────────────────────────

class _TicketHeaderCard extends StatelessWidget {
  const _TicketHeaderCard({required this.ticket});
  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final priorityColor = switch (ticket.priority) {
      'high' => const Color(0xFFEF4444),
      'low' => const Color(0xFF60A5FA),
      _ => const Color(0xFFFACC15),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ticket.subject,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _MetaChip(
                color: priorityColor,
                label: '${ticket.priority.toUpperCase()} PRIORITY',
              ),
              _MetaChip(
                color: tokens.textSecondary,
                label: DateFormat.yMMMd().add_jm().format(ticket.createdAt),
              ),
              if (ticket.preferredContact != null)
                _MetaChip(
                  color: const Color(0xFF25D366),
                  label: 'REPLY VIA ${ticket.preferredContact!.toUpperCase()}',
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.color, required this.label});
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

// ── Bubbles ────────────────────────────────────────────────────────

class _OriginalMessageBubble extends StatelessWidget {
  const _OriginalMessageBubble({required this.ticket});
  final SupportTicket ticket;
  @override
  Widget build(BuildContext context) {
    return _Bubble(
      isMine: true,
      author: 'You',
      body: ticket.message,
      timestamp: ticket.createdAt,
      trailingAttachments: [
        ...ticket.attachmentUrls,
        if (ticket.attachmentUrl != null &&
            !ticket.attachmentUrls.contains(ticket.attachmentUrl))
          ticket.attachmentUrl!,
      ],
    );
  }
}

class _ReplyBubble extends StatelessWidget {
  const _ReplyBubble({required this.reply});
  final SupportReply reply;
  @override
  Widget build(BuildContext context) {
    return _Bubble(
      isMine: !reply.isFromAdmin,
      author: reply.authorName ?? (reply.isFromAdmin ? 'Support' : 'You'),
      body: reply.body,
      timestamp: reply.createdAt,
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.isMine,
    required this.author,
    required this.body,
    required this.timestamp,
    this.trailingAttachments = const [],
  });
  final bool isMine;
  final String author;
  final String body;
  final DateTime timestamp;
  final List<String> trailingAttachments;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final align = isMine ? Alignment.centerRight : Alignment.centerLeft;
    final bg = isMine ? kColorAccent.withValues(alpha: 0.10) : tokens.bgSurface;
    final border = isMine
        ? kColorAccent.withValues(alpha: 0.35)
        : tokens.borderCard;
    return Align(
      alignment: align,
      child: ConstrainedBox(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.84),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(isMine ? 16 : 4),
              bottomRight: Radius.circular(isMine ? 4 : 16),
            ),
            border: Border.all(color: border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                author.toUpperCase(),
                style: TextStyle(
                  color: isMine ? kColorAccent : tokens.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                body,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
              if (trailingAttachments.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (int i = 0; i < trailingAttachments.length; i++)
                      _AttachmentChip(
                        url: trailingAttachments[i],
                        index: i + 1,
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 6),
              Text(
                DateFormat.jm().format(timestamp) +
                    ' · ' +
                    DateFormat.MMMd().format(timestamp),
                style: TextStyle(
                  color: tokens.textMuted,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttachmentChip extends StatelessWidget {
  const _AttachmentChip({required this.url, required this.index});
  final String url;
  final int index;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.attach_file, size: 11, color: tokens.textSecondary),
          const SizedBox(width: 4),
          Text(
            'Attachment $index',
            style: TextStyle(color: tokens.textSecondary, fontSize: 10.5),
          ),
        ],
      ),
    );
  }
}

// ── Compose bar ────────────────────────────────────────────────────

class _ComposeBar extends StatelessWidget {
  const _ComposeBar({
    required this.controller,
    required this.sending,
    required this.disabled,
    required this.onSend,
  });
  final TextEditingController controller;
  final bool sending;
  final bool disabled;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (disabled) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          border: Border(top: BorderSide(color: tokens.borderCard)),
        ),
        child: Center(
          child: Text(
            'This ticket is closed — raise a new one to follow up.',
            style: TextStyle(color: tokens.textMuted, fontSize: 12.5),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        border: Border(top: BorderSide(color: tokens.borderCard)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 5,
                style: TextStyle(color: tokens.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Reply to Support…',
                  hintStyle: TextStyle(color: tokens.textMuted),
                  filled: true,
                  fillColor: tokens.bgInput,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide(color: tokens.borderInput),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide(color: tokens.borderInput),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: const BorderSide(color: kColorAccent),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            _SendButton(sending: sending, onTap: onSend),
          ],
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({required this.sending, required this.onTap});
  final bool sending;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 44,
      height: 44,
      child: Material(
        color: kColorAccent,
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: sending ? null : onTap,
          child: Center(
            child: sending
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.send, color: Colors.white, size: 18),
          ),
        ),
      ),
    );
  }
}

// ── Status pill ────────────────────────────────────────────────────

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final map = {
      'new': (const Color(0xFF60A5FA), 'NEW'),
      'in_progress': (const Color(0xFFFACC15), 'IN PROGRESS'),
      'resolved': (const Color(0xFF4ADE80), 'RESOLVED'),
      'closed': (const Color(0xFFA0A0A0), 'CLOSED'),
    };
    final (color, label) = map[status] ?? (const Color(0xFFA0A0A0), status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
