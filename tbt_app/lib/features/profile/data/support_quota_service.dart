import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class SupportEntitlement {
  const SupportEntitlement({
    required this.allocated,
    required this.used,
    required this.remaining,
  });

  final int allocated;
  final int used;
  final int remaining;

  factory SupportEntitlement.fromJson(Map<String, dynamic> j) =>
      SupportEntitlement(
        allocated: (j['allocated'] as num?)?.toInt() ?? 0,
        used: (j['used'] as num?)?.toInt() ?? 0,
        remaining: (j['remaining'] as num?)?.toInt() ?? 0,
      );

  static const empty = SupportEntitlement(allocated: 0, used: 0, remaining: 0);
}

class SupportQuota {
  const SupportQuota({
    required this.techSupport,
    required this.adSupport,
    required this.groupCall,
    required this.callCredits,
    required this.oneToOne,
  });

  final SupportEntitlement techSupport;
  final SupportEntitlement adSupport;
  final SupportEntitlement groupCall;
  final SupportEntitlement callCredits;
  final SupportEntitlement oneToOne;

  factory SupportQuota.fromJson(Map<String, dynamic> j) => SupportQuota(
        techSupport: SupportEntitlement.fromJson(
            (j['techSupport'] as Map<String, dynamic>?) ?? {}),
        adSupport: SupportEntitlement.fromJson(
            (j['adSupport'] as Map<String, dynamic>?) ?? {}),
        groupCall: SupportEntitlement.fromJson(
            (j['groupCall'] as Map<String, dynamic>?) ?? {}),
        callCredits: SupportEntitlement.fromJson(
            (j['callCredits'] as Map<String, dynamic>?) ?? {}),
        oneToOne: SupportEntitlement.fromJson(
            (j['oneToOne'] as Map<String, dynamic>?) ?? {}),
      );
}

class CreditPricingItem {
  const CreditPricingItem({
    required this.creditType,
    required this.quantity,
    required this.amountInr,
    this.description,
  });

  final String creditType;
  final int quantity;
  final double amountInr;
  final String? description;

  factory CreditPricingItem.fromJson(Map<String, dynamic> j) =>
      CreditPricingItem(
        creditType: (j['creditType'] as String?) ?? '',
        quantity: (j['quantity'] as num?)?.toInt() ?? 1,
        amountInr: (j['amountInr'] as num?)?.toDouble() ?? 0.0,
        description: j['description'] as String?,
      );

  /// Human-readable label for the credit type (matches admin UI labels).
  String get label => switch (creditType) {
        'tech_support' => 'Tech Support',
        'ad_support' => 'Ad Support',
        'group_call' => 'Group Call',
        'call_credits' => 'Call Credits',
        'one_to_one' => '1:1 Session',
        'lifeline' => 'Lifeline',
        _ => creditType,
      };
}

class CreditPurchase {
  const CreditPurchase({
    required this.id,
    required this.creditType,
    required this.quantity,
    required this.amountInr,
    required this.status,
    this.paymentRef,
    required this.createdAt,
  });

  final String id;
  final String creditType;
  final int quantity;
  final double amountInr;

  /// One of: `'pending'` | `'approved'` | `'rejected'`
  final String status;
  final String? paymentRef;
  final String createdAt;

  factory CreditPurchase.fromJson(Map<String, dynamic> j) => CreditPurchase(
        id: (j['id'] as String?) ?? '',
        creditType: (j['creditType'] as String?) ?? '',
        quantity: (j['quantity'] as num?)?.toInt() ?? 1,
        amountInr: (j['amountInr'] as num?)?.toDouble() ?? 0.0,
        status: (j['status'] as String?) ?? 'pending',
        paymentRef: j['paymentRef'] as String?,
        createdAt: (j['createdAt'] as String?) ?? '',
      );

  /// Human-readable label for the credit type.
  String get creditTypeLabel => switch (creditType) {
        'tech_support' => 'Tech Support',
        'ad_support' => 'Ad Support',
        'group_call' => 'Group Call',
        'call_credits' => 'Call Credits',
        'one_to_one' => '1:1 Session',
        'lifeline' => 'Lifeline',
        _ => creditType,
      };
}

// ── Service ───────────────────────────────────────────────────────────────────

class SupportQuotaService {
  const SupportQuotaService(this._dio);
  final Dio _dio;

  /// GET /api/user/support-quota
  Future<SupportQuota> getSupportQuota() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>(kUserSupportQuota);
      final data =
          (res.data?['data'] as Map<String, dynamic>?) ?? res.data ?? {};
      return SupportQuota.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// GET /api/user/credits/pricing
  Future<List<CreditPricingItem>> getCreditPricing() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>(kUserCreditPricing);
      final list = (res.data?['data'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(CreditPricingItem.fromJson)
          .toList();
      return list;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// POST /api/user/credits/purchase
  Future<void> purchaseCredit({
    required String creditType,
    String? paymentRef,
  }) async {
    try {
      final body = <String, dynamic>{'creditType': creditType};
      if (paymentRef != null && paymentRef.isNotEmpty) {
        body['paymentRef'] = paymentRef;
      }
      await _dio.post<dynamic>(kUserCreditPurchase, data: body);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// GET /api/user/credits/purchases
  Future<List<CreditPurchase>> getMyCreditPurchases() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>(kUserCreditPurchases);
      final list = (res.data?['data'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(CreditPurchase.fromJson)
          .toList();
      return list;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final supportQuotaServiceProvider = Provider<SupportQuotaService>(
  (ref) => SupportQuotaService(ref.watch(dioProvider)),
);
