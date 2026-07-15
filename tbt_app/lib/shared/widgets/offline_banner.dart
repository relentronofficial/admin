import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/connectivity_provider.dart';

/// Persistent strip that renders at the top of the shell when the
/// device is offline. Backed by [connectivityProvider] — a single
/// source of truth reused by [AppErrorState] auto-retry logic so we
/// don't spin up two competing connectivity listeners.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    if (online) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: Colors.amber[800],
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      child: Text(
        AppL10n.of(context)!.offlineBannerMessage,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
