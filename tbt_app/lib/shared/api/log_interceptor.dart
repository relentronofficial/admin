import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Debug-only HTTP logger. All logging is inside `assert` so it compiles out
/// in release builds with zero overhead.
///
/// Uses `debugPrint` (routed to stdout during `flutter run`) rather than
/// `dev.log` (VM Service only). Makes it possible to diagnose failing
/// endpoints without opening DevTools.
class TbtLogInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    assert(() {
      debugPrint('[HTTP] --> ${options.method} ${options.path}');
      return true;
    }());
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    assert(() {
      final path = response.requestOptions.path;
      debugPrint('[HTTP] <-- ${response.statusCode} $path');
      // For playback endpoints, dump the URLs so we can diagnose stream errors.
      if (path.contains('/playback')) {
        final data = response.data;
        if (data is Map && data['data'] is Map) {
          final d = data['data'] as Map;
          debugPrint('[HTTP] playback videoType=${d['videoType']}');
          debugPrint('[HTTP] playback hlsUrl=${d['hlsUrl']}');
          debugPrint('[HTTP] playback videoUrl=${d['videoUrl']}');
          debugPrint('[HTTP] playback drmEnabled=${d['drmEnabled']}');
        }
      }
      return true;
    }());
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    assert(() {
      final status = err.response?.statusCode;
      final path = err.requestOptions.path;
      final type = err.type.name;
      final body = err.response?.data;
      debugPrint(
        '[HTTP] ERR ${status ?? '(no status)'} $path — type=$type msg=${err.message}',
      );
      if (body != null) {
        debugPrint('[HTTP] ERR body=$body');
      }
      return true;
    }());
    handler.next(err);
  }
}
