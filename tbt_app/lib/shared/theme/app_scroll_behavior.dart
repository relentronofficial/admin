import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// App-wide scroll behavior.
///
/// Two responsibilities:
///
///   1. **Platform-adaptive physics.** iOS gets `BouncingScrollPhysics`
///      (rubber-band overscroll — the OS standard); Android gets
///      `ClampingScrollPhysics` (hard stop + edge glow — the OS
///      standard). Flutter's default `MaterialScrollBehavior` already
///      does this, but only when the app runs on a real device — in
///      tests / desktop hosts it picks a platform-neutral value that
///      doesn't match the target. Locking it here removes that
///      ambiguity.
///
///   2. **Modern input support.** Enable mouse, trackpad, touch, stylus
///      and (crucially) trackpad on tablet builds so scroll works with
///      a keyboard + mouse when the app is embedded on iPad-with-magic-
///      keyboard, Chromebooks with touchscreens, etc. The default set
///      still omits `PointerDeviceKind.trackpad` on some Flutter
///      versions and shows up as "trackpad doesn't scroll" on iPad.
///
///   3. **Overscroll indicator behavior.** Android's glowing edge
///      overscroll indicator is kept on Android and hidden on iOS
///      (where bounce is the indicator). Prevents the glow leaking
///      through on the iOS build in profile mode.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => const {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.trackpad,
        PointerDeviceKind.stylus,
        PointerDeviceKind.invertedStylus,
      };

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return const BouncingScrollPhysics(
          decelerationRate: ScrollDecelerationRate.fast,
        );
      case TargetPlatform.android:
      case TargetPlatform.fuchsia:
      case TargetPlatform.linux:
      case TargetPlatform.windows:
        // ClampingScrollPhysics + AlwaysScrollable so pull-to-refresh
        // works even on short content that would otherwise not scroll.
        return const ClampingScrollPhysics()
            .applyTo(const AlwaysScrollableScrollPhysics());
    }
  }

  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.fuchsia:
        // Android 12+ "stretch" overscroll indicator — the OS default,
        // more organic than the old glow.
        return StretchingOverscrollIndicator(
          axisDirection: details.direction,
          child: child,
        );
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.linux:
      case TargetPlatform.windows:
        // iOS gets no indicator — the bounce itself is the affordance.
        return child;
    }
  }
}
