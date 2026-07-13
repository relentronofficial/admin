import 'package:dio/dio.dart';

import '../../core/constants/api.dart';
import 'token_storage.dart';

/// Catches 401 responses, pauses in-flight requests, refreshes the session,
/// then replays all queued requests with the new token.
///
/// Skips refresh for any path that starts with `/api/user-auth/` to avoid
/// infinite loops on login/refresh/logout endpoints themselves.
class RefreshInterceptor extends Interceptor {
  RefreshInterceptor(this._dio);

  final Dio _dio;
  bool _refreshing = false;
  final _queue = <(RequestOptions, ErrorInterceptorHandler)>[];

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final status = err.response?.statusCode;
    final path = err.requestOptions.path;

    if (status != 401 || path.startsWith('/api/user-auth/')) {
      return handler.next(err);
    }

    if (_refreshing) {
      _queue.add((err.requestOptions, handler));
      return;
    }

    _refreshing = true;
    try {
      final refreshToken = await TokenStorage.readRefreshToken();
      if (refreshToken == null) {
        _drainQueue(err);
        return handler.next(err);
      }

      final refreshResponse = await _dio.post<dynamic>(
        kAuthRefresh,
        options: Options(headers: {'Cookie': 'tbt_refresh=$refreshToken'}),
      );

      final setCookies = refreshResponse.headers.map['set-cookie'];
      final newAccess =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_access');
      final newRefresh =
          TokenStorage.extractFromSetCookie(setCookies, 'tbt_refresh');

      if (newAccess != null) await TokenStorage.writeAccessToken(newAccess);
      if (newRefresh != null) await TokenStorage.writeRefreshToken(newRefresh);

      // Retry original request
      err.requestOptions.headers['Cookie'] = 'tbt_access=${newAccess ?? ''}';
      final retried = await _dio.fetch<dynamic>(err.requestOptions);
      _retryQueue(newAccess);
      handler.resolve(retried);
    } catch (_) {
      await TokenStorage.clearAll();
      _drainQueue(err);
      handler.next(err);
    } finally {
      _refreshing = false;
    }
  }

  void _retryQueue(String? newAccess) {
    for (final (opts, h) in _queue) {
      if (newAccess != null) opts.headers['Cookie'] = 'tbt_access=$newAccess';
      _dio.fetch<dynamic>(opts).then(
        h.resolve,
        onError: (Object e) => h.next(
          e is DioException
              ? e
              : DioException(requestOptions: opts, error: e),
        ),
      );
    }
    _queue.clear();
  }

  void _drainQueue(DioException err) {
    for (final (_, h) in _queue) {
      h.next(err);
    }
    _queue.clear();
  }
}
