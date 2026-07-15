import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Streams the device's connectivity state.
///
/// `connectivity_plus` returns a `List<ConnectivityResult>` because on
/// Android a device can be simultaneously on wifi + cellular; we
/// collapse that to a single `isOnline` bool that reads better at call
/// sites.
///
/// Consumers should `ref.listen` this — it powers auto-retry in
/// [AppErrorState] and the offline banner in the app shell. Providers
/// that need to invalidate when connectivity returns can watch it
/// directly and compare previous/current state.
final connectivityProvider = StreamProvider<bool>((ref) async* {
  // Seed with the current state so downstream widgets don't flash
  // "offline" for the first frame while the platform stream boots.
  final initial = await Connectivity().checkConnectivity();
  yield _isOnline(initial);

  yield* Connectivity().onConnectivityChanged.map(_isOnline);
});

bool _isOnline(List<ConnectivityResult> results) =>
    results.isNotEmpty && results.any((r) => r != ConnectivityResult.none);
