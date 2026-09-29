import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';

part 'credits_provider.g.dart';

// ── Credit approved event (keepAlive) ─────────────────────────────────────────

class CreditApprovedEvent {
  final String creditType;
  final int quantity;
  final String message;

  const CreditApprovedEvent({
    required this.creditType,
    required this.quantity,
    required this.message,
  });
}

@Riverpod(keepAlive: true)
class CreditApprovedNotifier extends _$CreditApprovedNotifier {
  @override
  CreditApprovedEvent? build() {
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        state = CreditApprovedEvent(
          creditType: map['creditType'] as String? ?? '',
          quantity: (map['quantity'] as num?)?.toInt() ?? 1,
          message: map['message'] as String? ?? 'Your purchase has been approved!',
        );
      } catch (_) {}
    }
    socket.on(kSocketCreditApproved, handler);
    ref.onDispose(() => socket.off(kSocketCreditApproved, handler));
    return null;
  }
}

// ── Credit rejected event (keepAlive) ─────────────────────────────────────────

class CreditRejectedEvent {
  final String message;

  const CreditRejectedEvent({required this.message});
}

@Riverpod(keepAlive: true)
class CreditRejectedNotifier extends _$CreditRejectedNotifier {
  @override
  CreditRejectedEvent? build() {
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        state = CreditRejectedEvent(
          message: map['message'] as String? ?? 'Your purchase request could not be approved.',
        );
      } catch (_) {}
    }
    socket.on(kSocketCreditRejected, handler);
    ref.onDispose(() => socket.off(kSocketCreditRejected, handler));
    return null;
  }
}
