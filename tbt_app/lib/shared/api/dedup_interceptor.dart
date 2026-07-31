import 'dart:async';

import 'package:dio/dio.dart';

/// In-flight request deduplication for `GET` calls.
///
/// Solves a class of fan-out bugs where several widgets/providers each
/// call `dioProvider.get('/api/user/me')` at the same time and each one
/// fires an independent network round-trip. With this interceptor, only
/// the first request per unique `(method, path, sorted query)` actually
/// leaves the phone — every subsequent caller waits on the same future
/// and receives the same response body.
///
/// Contract:
///   * Only `GET`. Anything else bypasses.
///   * Callers that genuinely need a fresh network hit (rare — e.g. a
///     probe endpoint that expects to change between calls) can opt out
///     with `Options(extra: { 'noDedup': true })`.
///   * Piggyback callers receive a `Response` object that references
///     *their own* `RequestOptions` (so `response.requestOptions` and
///     any interceptor state on that request are still theirs), but
///     `data`, `statusCode`, and `headers` come from the shared trip.
///   * On error, all piggybacks receive the same `DioException` — the
///     exception's `requestOptions` is rebound to each caller so
///     downstream error handlers don't see the wrong URL.
///
/// Interceptor ordering: registered first, so the piggyback path skips
/// auth-token attachment and the refresh flow entirely. The primary
/// request still traverses the whole pipeline.
class DedupInterceptor extends Interceptor {
  final Map<String, Future<Response<dynamic>>> _inflight = {};

  static const _extraKey = '_dedupKey';
  static const _extraCompleter = '_dedupCompleter';
  static const _optOutFlag = 'noDedup';

  String _keyFor(RequestOptions options) {
    final buf = StringBuffer(options.method)
      ..write(' ')
      ..write(options.uri.origin)
      ..write(options.uri.path);
    final q = options.queryParameters.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    if (q.isNotEmpty) {
      buf.write('?');
      for (var i = 0; i < q.length; i++) {
        if (i > 0) buf.write('&');
        buf
          ..write(q[i].key)
          ..write('=')
          ..write(q[i].value);
      }
    }
    return buf.toString();
  }

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.method.toUpperCase() != 'GET' ||
        options.extra[_optOutFlag] == true) {
      return handler.next(options);
    }

    final key = _keyFor(options);
    final pending = _inflight[key];
    if (pending != null) {
      try {
        final shared = await pending;
        // Rebind the shared body to this caller's RequestOptions so any
        // downstream interceptor / caller sees a Response tied to the
        // request they actually initiated.
        return handler.resolve(
          Response<dynamic>(
            requestOptions: options,
            data: shared.data,
            statusCode: shared.statusCode,
            statusMessage: shared.statusMessage,
            headers: shared.headers,
            isRedirect: shared.isRedirect,
            redirects: shared.redirects,
            extra: shared.extra,
          ),
        );
      } on DioException catch (e) {
        return handler.reject(
          DioException(
            requestOptions: options,
            response: e.response == null
                ? null
                : Response<dynamic>(
                    requestOptions: options,
                    data: e.response!.data,
                    statusCode: e.response!.statusCode,
                    statusMessage: e.response!.statusMessage,
                    headers: e.response!.headers,
                  ),
            type: e.type,
            error: e.error,
            message: e.message,
            stackTrace: e.stackTrace,
          ),
        );
      } catch (e, st) {
        return handler.reject(
          DioException(
            requestOptions: options,
            error: e,
            stackTrace: st,
            type: DioExceptionType.unknown,
          ),
        );
      }
    }

    // First caller for this key — register a completer that the response
    // / error hooks below will fulfil, then let the request proceed.
    final completer = Completer<Response<dynamic>>();
    _inflight[key] = completer.future;
    options.extra[_extraKey] = key;
    options.extra[_extraCompleter] = completer;
    return handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _release(response.requestOptions, response, null);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _release(err.requestOptions, null, err);
    handler.next(err);
  }

  void _release(
    RequestOptions options,
    Response<dynamic>? response,
    DioException? error,
  ) {
    final key = options.extra[_extraKey] as String?;
    final completer =
        options.extra[_extraCompleter] as Completer<Response<dynamic>>?;
    if (completer != null && !completer.isCompleted) {
      if (error != null) {
        completer.completeError(error, error.stackTrace);
      } else if (response != null) {
        completer.complete(response);
      }
    }
    if (key != null) _inflight.remove(key);
  }
}
