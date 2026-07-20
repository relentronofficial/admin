import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../domain/support_models.dart';

class SupportService {
  const SupportService(this._dio);
  final Dio _dio;

  Future<HelpdeskSettings?> getSettings() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kHelpdeskSettings);
      final data = res.data?['data'];
      if (data == null) return null;
      return HelpdeskSettings.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<SupportCategory>> listCategories() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kHelpdeskCategories);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(SupportCategory.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<Faq>> listFaqs({String? categoryId, String? search}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kHelpdeskFaqs,
        queryParameters: {
          if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(Faq.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submitTicket({
    required String name,
    required String email,
    required String subject,
    required String message,
    String? phone,
    String? categoryId,
    String? attachmentUrl,
  }) async {
    try {
      await _dio.post<dynamic>(kHelpdeskTickets, data: {
        'name': name,
        'email': email,
        'subject': subject,
        'message': message,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
        if (attachmentUrl != null && attachmentUrl.isNotEmpty) 'attachmentUrl': attachmentUrl,
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<SupportTicket>> myTickets() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kHelpdeskMyTickets);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(SupportTicket.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submitFeedback({
    required String message,
    int? rating,
    String? name,
    String? email,
  }) async {
    try {
      await _dio.post<dynamic>(kHelpdeskFeedback, data: {
        'message': message,
        if (rating != null) 'rating': rating,
        if (name != null && name.isNotEmpty) 'name': name,
        if (email != null && email.isNotEmpty) 'email': email,
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final supportServiceProvider = Provider<SupportService>(
  (ref) => SupportService(ref.watch(dioProvider)),
);
