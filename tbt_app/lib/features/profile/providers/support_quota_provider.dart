import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/support_quota_service.dart';

/// Fetches the member's current plan entitlement quota.
/// Invalidate after a credit purchase is approved to refresh the display.
final supportQuotaProvider =
    FutureProvider.autoDispose<SupportQuota>((ref) =>
        ref.read(supportQuotaServiceProvider).getSupportQuota());

/// Fetches the admin-configured credit pricing table.
final creditPricingProvider =
    FutureProvider.autoDispose<List<CreditPricingItem>>((ref) =>
        ref.read(supportQuotaServiceProvider).getCreditPricing());

/// Fetches the member's own credit purchase history.
final myCreditPurchasesProvider =
    FutureProvider.autoDispose<List<CreditPurchase>>((ref) =>
        ref.read(supportQuotaServiceProvider).getMyCreditPurchases());
