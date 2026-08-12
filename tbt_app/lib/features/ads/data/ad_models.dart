/// Ad campaign DTOs — TBT_ADS_SPECKIT.md §10.
///
/// Hand-written rather than freezed/json_serializable, matching the convention
/// the podcasts and ai_content features established: these are read-only
/// response shapes with no copyWith/equality needs, and keeping them
/// codegen-free means `build_runner` is never a prerequisite for the ad system
/// to compile.
///
/// Every field mirrors the `/api/ads/eligible` payload the backend builds in
/// `modules/ads/controller.ts`. Dart deserialization is strict where TypeScript
/// is forgiving (CLAUDE.md mobile pitfall #2), so every field here is either
/// nullable or has a default — a campaign that omits an optional config must
/// not throw at parse time and cost the user their ad-free app.
library;

class AdSkipConfig {
  const AdSkipConfig({required this.enabled, this.type, this.value});

  final bool enabled;

  /// `seconds` | `percent` | `after_end` | `immediate`.
  final String? type;
  final num? value;

  factory AdSkipConfig.fromJson(Map<String, dynamic> json) => AdSkipConfig(
        enabled: json['enabled'] as bool? ?? false,
        type: json['type'] as String?,
        value: json['value'] as num?,
      );

  static const disabled = AdSkipConfig(enabled: false);
}

class AdCloseConfig {
  const AdCloseConfig({
    required this.enabled,
    this.autoClose = false,
    this.autoCloseSeconds,
  });

  final bool enabled;
  final bool autoClose;
  final int? autoCloseSeconds;

  factory AdCloseConfig.fromJson(Map<String, dynamic> json) => AdCloseConfig(
        enabled: json['enabled'] as bool? ?? false,
        autoClose: json['autoClose'] as bool? ?? false,
        autoCloseSeconds: (json['autoCloseSeconds'] as num?)?.toInt(),
      );

  static const disabled = AdCloseConfig(enabled: false);
}

class AdCtaConfig {
  const AdCtaConfig({
    required this.enabled,
    this.text,
    this.type,
    this.target,
    this.showAfterSeconds,
    this.openInNewTab = true,
  });

  final bool enabled;
  final String? text;

  /// `internal_route` | `external_url`.
  final String? type;
  final String? target;
  final num? showAfterSeconds;
  final bool openInNewTab;

  factory AdCtaConfig.fromJson(Map<String, dynamic> json) => AdCtaConfig(
        enabled: json['enabled'] as bool? ?? false,
        text: json['text'] as String?,
        type: json['type'] as String?,
        target: json['target'] as String?,
        showAfterSeconds: json['showAfterSeconds'] as num?,
        openInNewTab: json['openInNewTab'] as bool? ?? true,
      );

  static const disabled = AdCtaConfig(enabled: false);
}

class AdCampaign {
  const AdCampaign({
    required this.id,
    required this.name,
    required this.mediaType,
    required this.objectFit,
    required this.autoplay,
    required this.muted,
    required this.loop,
    required this.skipConfig,
    required this.closeConfig,
    required this.ctaConfig,
    this.mediaUrl,
    this.videoType,
    this.bunnyVideoId,
    this.thumbnailUrl,
    this.fallbackMediaUrl,
    this.durationSeconds,
    this.backgroundColor,
    this.skipAvailableAfterSeconds,
  });

  final String id;
  final String name;

  /// `image` | `video`.
  final String mediaType;

  /// For video: the HLS playlist when `videoType == 'hls'`, otherwise the Bunny
  /// embed URL. For image: the creative.
  final String? mediaUrl;

  /// `hls` | `iframe` | null (image campaigns). Same discriminator the course
  /// and workshop playback endpoints return, so the two-tier player choice is
  /// the one this app already makes everywhere else.
  final String? videoType;

  final String? bunnyVideoId;
  final String? thumbnailUrl;
  final String? fallbackMediaUrl;
  final int? durationSeconds;

  /// `contain` | `cover` | `fill`.
  final String objectFit;
  final String? backgroundColor;
  final bool autoplay;
  final bool muted;
  final bool loop;

  final AdSkipConfig skipConfig;
  final AdCloseConfig closeConfig;
  final AdCtaConfig ctaConfig;

  /// Server-computed unlock point for the skip control. Authoritative — the
  /// client only re-derives it when the server could not (percent-based gating
  /// on a creative whose duration is unknown until playback starts).
  final num? skipAvailableAfterSeconds;

  static Map<String, dynamic> _obj(dynamic v) =>
      v is Map<String, dynamic> ? v : const {};

  factory AdCampaign.fromJson(Map<String, dynamic> json) => AdCampaign(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        mediaType: json['mediaType'] as String? ?? 'image',
        mediaUrl: json['mediaUrl'] as String?,
        videoType: json['videoType'] as String?,
        bunnyVideoId: json['bunnyVideoId'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
        fallbackMediaUrl: json['fallbackMediaUrl'] as String?,
        durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
        objectFit: json['objectFit'] as String? ?? 'contain',
        backgroundColor: json['backgroundColor'] as String?,
        autoplay: json['autoplay'] as bool? ?? true,
        muted: json['muted'] as bool? ?? true,
        loop: json['loop'] as bool? ?? false,
        skipConfig: json['skipConfig'] == null
            ? AdSkipConfig.disabled
            : AdSkipConfig.fromJson(_obj(json['skipConfig'])),
        closeConfig: json['closeConfig'] == null
            ? AdCloseConfig.disabled
            : AdCloseConfig.fromJson(_obj(json['closeConfig'])),
        ctaConfig: json['ctaConfig'] == null
            ? AdCtaConfig.disabled
            : AdCtaConfig.fromJson(_obj(json['ctaConfig'])),
        skipAvailableAfterSeconds: json['skipAvailableAfterSeconds'] as num?,
      );

  bool get isVideo => mediaType == 'video';

  /// When the skip control unlocks, in seconds from playback start. Mirrors
  /// `skipAvailableAfterSeconds()` in the backend eligibility engine and the
  /// same helper on user-web. `null` = never (disabled, or only after the ad
  /// ends).
  ///
  /// [knownDuration] is the real media duration once the player reports it,
  /// which is what makes percent-based gating possible for a creative whose
  /// length the admin never entered.
  double? skipUnlockSeconds(double? knownDuration) {
    if (!skipConfig.enabled) return null;
    switch (skipConfig.type) {
      case 'immediate':
        return 0;
      case 'seconds':
        return (skipConfig.value ?? 0).toDouble().clamp(0, double.infinity);
      case 'percent':
        final d = knownDuration ?? durationSeconds?.toDouble();
        if (d == null || d <= 0 || skipConfig.value == null) return null;
        final p = skipConfig.value!.toDouble().clamp(0, 100);
        return d * p / 100;
      case 'after_end':
      default:
        // The server may still have computed a value (seconds-based config
        // reaching us with an unexpected type string); prefer it over guessing.
        return skipAvailableAfterSeconds?.toDouble();
    }
  }
}

/// `POST /api/ads/eligible` response. `showAd: false` is the overwhelmingly
/// common case and must stay cheap — no campaign parsing at all.
class AdEligibleResult {
  const AdEligibleResult({required this.showAd, this.displayToken, this.campaign});

  final bool showAd;
  final String? displayToken;
  final AdCampaign? campaign;

  static const none = AdEligibleResult(showAd: false);

  factory AdEligibleResult.fromJson(Map<String, dynamic> json) {
    final show = json['showAd'] as bool? ?? false;
    final campaign = json['campaign'];
    final token = json['displayToken'] as String?;
    if (!show || campaign is! Map<String, dynamic> || token == null) {
      return none;
    }
    return AdEligibleResult(
      showAd: true,
      displayToken: token,
      campaign: AdCampaign.fromJson(campaign),
    );
  }
}

/// Why an ad ended. Every one of these runs the same teardown (§7.2).
enum AdEndReason {
  completed,
  skipped,
  closed,
  cta,
  mediaError,
  loadTimeout,
  invalidated,
}
