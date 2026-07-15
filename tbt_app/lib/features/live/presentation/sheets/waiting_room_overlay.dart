import 'package:flutter/material.dart';

/// Full-screen overlay shown while the LiveKit room is locked
/// (`live_call:lock` socket event) and the host hasn't admitted the user
/// yet. Sits above the LiveKit stream area — see
/// [LiveCallScreen]'s Stack in `live_call_screen.dart`. Dismissed
/// automatically when `live_call:admitted` clears the lock state.
class WaitingRoomOverlay extends StatelessWidget {
  const WaitingRoomOverlay({
    super.key,
    required this.accent,
    required this.onLeave,
  });

  final Color accent;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withValues(alpha: 0.92),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 56,
            height: 56,
            child: CircularProgressIndicator(color: accent, strokeWidth: 3),
          ),
          const SizedBox(height: 24),
          const Text(
            'Waiting to be admitted',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'The host has locked the room. You’ll join automatically as soon '
            'as they let you in.',
            style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: onLeave,
            icon: const Icon(Icons.close, size: 16),
            label: const Text('Leave'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white70,
              side: const BorderSide(color: Colors.white24),
            ),
          ),
        ],
      ),
    );
  }
}
