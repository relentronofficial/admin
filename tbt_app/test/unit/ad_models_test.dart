// Ad DTO parsing and skip gating — TBT_ADS_SPECKIT.md §10, tested per §15.
//
// Dart deserialization is strict where TypeScript is forgiving (CLAUDE.md
// mobile pitfall #2): a field the backend stops sending, or sends as null,
// throws at parse time here and costs the user the whole ad system. These tests
// pin the tolerance the models are supposed to have.
//
// `skipUnlockSeconds` is tested against the same cases as the backend's
// `skipAvailableAfterSeconds`, because the two must agree — the server value is
// authoritative, and this is the client's fallback when the server could not
// compute one (percent gating on a creative of unknown length).

import 'package:flutter_test/flutter_test.dart';
import 'package:tbt_app/features/ads/data/ad_models.dart';

const Map<String, dynamic> _minimalCampaign = {
  'id': 'c1',
  'name': 'Diwali Promo',
  'mediaType': 'image',
  'mediaUrl': 'https://cdn.example.com/a.webp',
};

void main() {
  group('AdCampaign.fromJson', () {
    test('parses a full video campaign', () {
      final campaign = AdCampaign.fromJson({
        'id': 'c1',
        'name': 'Diwali Promo',
        'mediaType': 'video',
        'mediaUrl': 'https://cdn.example.com/playlist.m3u8',
        'videoType': 'hls',
        'bunnyVideoId': 'v-123',
        'thumbnailUrl': 'https://cdn.example.com/t.webp',
        'fallbackMediaUrl': 'https://cdn.example.com/f.webp',
        'durationSeconds': 30,
        'objectFit': 'cover',
        'backgroundColor': '#101010',
        'autoplay': true,
        'muted': false,
        'loop': true,
        'skipConfig': {'enabled': true, 'type': 'seconds', 'value': 5},
        'closeConfig': {'enabled': true, 'autoClose': true, 'autoCloseSeconds': 10},
        'ctaConfig': {
          'enabled': true,
          'text': 'Learn More',
          'type': 'internal_route',
          'target': '/courses/abc',
          'showAfterSeconds': 3,
        },
        'skipAvailableAfterSeconds': 5,
      });

      expect(campaign.isVideo, isTrue);
      expect(campaign.videoType, 'hls');
      expect(campaign.durationSeconds, 30);
      expect(campaign.muted, isFalse);
      expect(campaign.loop, isTrue);
      expect(campaign.skipConfig.enabled, isTrue);
      expect(campaign.closeConfig.autoCloseSeconds, 10);
      expect(campaign.ctaConfig.target, '/courses/abc');
      expect(campaign.skipAvailableAfterSeconds, 5);
    });

    test('survives a campaign with every optional field missing', () {
      // The backend omits configs it has nothing to say about. Throwing here
      // would take the ad system down for a campaign that is merely simple.
      final campaign = AdCampaign.fromJson(_minimalCampaign);

      expect(campaign.id, 'c1');
      expect(campaign.isVideo, isFalse);
      expect(campaign.objectFit, 'contain');
      expect(campaign.autoplay, isTrue);
      expect(campaign.muted, isTrue);
      expect(campaign.loop, isFalse);
      expect(campaign.skipConfig.enabled, isFalse);
      expect(campaign.closeConfig.enabled, isFalse);
      expect(campaign.ctaConfig.enabled, isFalse);
      expect(campaign.durationSeconds, isNull);
    });

    test('survives explicit nulls on the optional configs', () {
      final campaign = AdCampaign.fromJson({
        ..._minimalCampaign,
        'ctaConfig': null,
        'closeConfig': null,
        'skipConfig': null,
        'thumbnailUrl': null,
        'durationSeconds': null,
      });

      expect(campaign.ctaConfig.enabled, isFalse);
      expect(campaign.skipConfig.enabled, isFalse);
      expect(campaign.thumbnailUrl, isNull);
    });

    test('accepts a numeric duration sent as a double', () {
      // JSON numbers arrive as either int or double depending on the encoder.
      final campaign = AdCampaign.fromJson({..._minimalCampaign, 'durationSeconds': 30.0});
      expect(campaign.durationSeconds, 30);
    });
  });

  group('AdEligibleResult.fromJson', () {
    test('parses an available ad', () {
      final result = AdEligibleResult.fromJson({
        'showAd': true,
        'displayToken': 'token-1',
        'campaign': _minimalCampaign,
      });

      expect(result.showAd, isTrue);
      expect(result.displayToken, 'token-1');
      expect(result.campaign?.id, 'c1');
    });

    test('parses the no-ad case without touching the campaign', () {
      final result = AdEligibleResult.fromJson({'showAd': false, 'campaign': null});
      expect(result.showAd, isFalse);
      expect(result.campaign, isNull);
    });

    test('treats a malformed payload as no-ad rather than throwing', () {
      // showAd true but nothing to show. Degrading to "no ad" is the rule (§11).
      expect(AdEligibleResult.fromJson({'showAd': true}).showAd, isFalse);
      expect(AdEligibleResult.fromJson({'showAd': true, 'campaign': 'nonsense'}).showAd, isFalse);
      expect(
        AdEligibleResult.fromJson({'showAd': true, 'campaign': _minimalCampaign}).showAd,
        isFalse,
        reason: 'a campaign without a display token cannot be tracked, so it must not show',
      );
      expect(AdEligibleResult.fromJson({}).showAd, isFalse);
    });
  });

  group('skipUnlockSeconds', () {
    AdCampaign withSkip(Map<String, dynamic> skip, {int? duration}) => AdCampaign.fromJson({
          ..._minimalCampaign,
          'skipConfig': skip,
          if (duration != null) 'durationSeconds': duration,
        });

    test('immediate unlocks at zero', () {
      expect(withSkip({'enabled': true, 'type': 'immediate'}).skipUnlockSeconds(null), 0);
    });

    test('seconds unlocks at the configured value', () {
      expect(withSkip({'enabled': true, 'type': 'seconds', 'value': 5}).skipUnlockSeconds(null), 5);
    });

    test('percent needs a duration, preferring the one the player reported', () {
      final campaign = withSkip({'enabled': true, 'type': 'percent', 'value': 50}, duration: 30);
      expect(campaign.skipUnlockSeconds(null), 15);
      // The real media turned out to be 60s — gate on that, not the admin's guess.
      expect(campaign.skipUnlockSeconds(60), 30);

      final noDuration = withSkip({'enabled': true, 'type': 'percent', 'value': 50});
      expect(noDuration.skipUnlockSeconds(null), isNull);
    });

    test('after_end never unlocks on its own', () {
      expect(withSkip({'enabled': true, 'type': 'after_end'}).skipUnlockSeconds(30), isNull);
    });

    test('a disabled skip never unlocks', () {
      expect(withSkip({'enabled': false, 'type': 'seconds', 'value': 5}).skipUnlockSeconds(30), isNull);
    });

    test('clamps a percent outside 0-100', () {
      expect(withSkip({'enabled': true, 'type': 'percent', 'value': 140}, duration: 30)
          .skipUnlockSeconds(null), 30);
      expect(withSkip({'enabled': true, 'type': 'percent', 'value': -10}, duration: 30)
          .skipUnlockSeconds(null), 0);
    });
  });
}
