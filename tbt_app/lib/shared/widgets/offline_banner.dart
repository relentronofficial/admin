import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

class OfflineBanner extends StatefulWidget {
  const OfflineBanner({super.key});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    // Seed with current state immediately.
    Connectivity().checkConnectivity().then((results) {
      if (mounted) setState(() => _isOffline = _offline(results));
    });
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      if (mounted) setState(() => _isOffline = _offline(results));
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  static bool _offline(List<ConnectivityResult> results) =>
      results.isEmpty || results.every((r) => r == ConnectivityResult.none);

  @override
  Widget build(BuildContext context) {
    if (!_isOffline) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: Colors.amber[800],
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      child: const Text(
        'You are offline',
        style: TextStyle(
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
