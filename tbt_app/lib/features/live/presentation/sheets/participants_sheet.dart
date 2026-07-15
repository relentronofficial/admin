import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart' hide ConnectionState;

import '../../../../shared/theme/theme_tokens.dart';

/// Bottom sheet listing the local + remote participants in the LiveKit
/// room with their mic / camera status. Snapshot-only — reopening the
/// sheet after someone joins or leaves reflects the latest state.
class ParticipantsSheet extends StatelessWidget {
  const ParticipantsSheet({
    super.key,
    required this.room,
    required this.accent,
  });

  final Room room;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final local = room.localParticipant;
    final entries = <_ParticipantRow>[];
    if (local != null) {
      entries.add(_ParticipantRow(
        identity: local.identity,
        name: local.name.isEmpty ? 'You' : '${local.name} (you)',
        isMicOn: local.isMicrophoneEnabled(),
        isCameraOn: local.isCameraEnabled(),
        isLocal: true,
      ));
    }
    for (final p in room.remoteParticipants.values) {
      entries.add(_ParticipantRow(
        identity: p.identity,
        name: p.name.isEmpty ? p.identity : p.name,
        isMicOn: p.isMicrophoneEnabled(),
        isCameraOn: p.isCameraEnabled(),
        isLocal: false,
      ));
    }

    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: context.tokens.textMuted.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Row(
            children: [
              Icon(Icons.people_outline,
                  color: context.tokens.textPrimary, size: 18),
              const SizedBox(width: 8),
              Text(
                'Participants (${entries.length})',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: context.tokens.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (entries.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text('No participants yet',
                    style: TextStyle(
                        color: context.tokens.textMuted, fontSize: 13)),
              ),
            )
          else
            ConstrainedBox(
              constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.6),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: entries.length,
                separatorBuilder: (_, __) =>
                    Divider(color: context.tokens.borderCard, height: 1),
                itemBuilder: (_, i) => _tile(context, entries[i]),
              ),
            ),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, _ParticipantRow r) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor:
                r.isLocal ? accent.withValues(alpha: 0.15) : context.tokens.bgInput,
            child: Text(
              r.name.isNotEmpty ? r.name[0].toUpperCase() : '?',
              style: TextStyle(
                color: r.isLocal ? accent : context.tokens.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              r.name,
              style: TextStyle(
                color: context.tokens.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Icon(
            r.isMicOn ? Icons.mic : Icons.mic_off,
            color: r.isMicOn ? context.tokens.textSecondary : context.tokens.textMuted,
            size: 16,
          ),
          const SizedBox(width: 10),
          Icon(
            r.isCameraOn ? Icons.videocam : Icons.videocam_off,
            color:
                r.isCameraOn ? context.tokens.textSecondary : context.tokens.textMuted,
            size: 16,
          ),
        ],
      ),
    );
  }
}

class _ParticipantRow {
  const _ParticipantRow({
    required this.identity,
    required this.name,
    required this.isMicOn,
    required this.isCameraOn,
    required this.isLocal,
  });

  final String identity;
  final String name;
  final bool isMicOn;
  final bool isCameraOn;
  final bool isLocal;
}
