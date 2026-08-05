import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../domain/chat_group_models.dart';
import '../providers/chat_group_providers.dart';

/// Bottom sheet — group avatar/name/description + member list with
/// presence dot + leave button.
class ChatGroupInfoSheet extends ConsumerWidget {
  const ChatGroupInfoSheet({super.key, required this.detail, required this.onLeave});
  final ChatGroupDetail detail;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final presenceMap = ref.watch(chatGroupPresenceProvider(detail.id)).valueOrNull ?? const {};

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtl) {
        return Container(
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
                decoration: BoxDecoration(
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  controller: scrollCtl,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  children: [
                    // Header
                    Center(
                      child: Column(
                        children: [
                          _Avatar(url: detail.avatarUrl, size: 72, name: detail.name),
                          const SizedBox(height: 10),
                          Text(
                            detail.name,
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (detail.description != null && detail.description!.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              detail.description!,
                              textAlign: TextAlign.center,
                              style: TextStyle(color: tokens.textSecondary, fontSize: 12, height: 1.4),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8, left: 4),
                      child: Text(
                        '${detail.members.length} member${detail.members.length == 1 ? "" : "s"}'.toUpperCase(),
                        style: TextStyle(
                          color: tokens.textMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                    ...detail.members.map((m) {
                      final online = presenceMap[m.id] == true;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: tokens.bgInput,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Stack(children: [
                              _Avatar(url: m.profilePhotoUrl, name: m.displayName, size: 34),
                              if (online)
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 10,
                                    height: 10,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF22C55E),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: tokens.bgSurface, width: 1.5),
                                    ),
                                  ),
                                ),
                            ]),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(m.displayName, style: TextStyle(color: tokens.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
                                  Text(
                                    online ? 'Online' : 'Offline',
                                    style: TextStyle(color: tokens.textMuted, fontSize: 10),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: onLeave,
                      icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
                      label: const Text('Leave group', style: TextStyle(color: Color(0xFFEF4444))),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        side: const BorderSide(color: Color(0xFFEF4444)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.url, required this.name, this.size = 40});
  final String? url;
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    if (url != null && url!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: kColorAccent, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(color: Colors.white, fontSize: size * 0.42, fontWeight: FontWeight.w700),
      ),
    );
  }
}
