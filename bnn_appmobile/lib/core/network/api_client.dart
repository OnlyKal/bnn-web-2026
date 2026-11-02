import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config.dart';
import '../storage/session_storage.dart';

/// Client HTTP de l'API BNN.
///
/// - ajoute l'en-tête `Authorization` à chaque requête ;
/// - sur un 401, tente une seule fois de renouveler le jeton (`/auth/refresh/`),
///   les requêtes concurrentes attendent ce renouvellement (intercepteur en file) ;
/// - si le renouvellement échoue, [onSessionExpired] est appelé.
class ApiClient {
  ApiClient(this._session, {this.onSessionExpired}) {
    _dio = Dio(_options(AppConfig.apiBaseUrl));
    _plain = Dio(_options(AppConfig.apiBaseUrl));
    _dio.interceptors.add(
      QueuedInterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
  }

  final SessionStorage _session;
  VoidCallback? onSessionExpired;

  late final Dio _dio;

  /// Instance sans authentification ni renouvellement (connexion, inscription…).
  late final Dio _plain;

  Dio get dio => _dio;
  Dio get unauthenticated => _plain;

  static const _publicPaths = [
    '/user/signin/',
    '/user/signup/',
    '/user/password-reset/',
    '/auth/refresh/',
  ];

  static BaseOptions _options(String baseUrl) => BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: AppConfig.requestTimeout,
        receiveTimeout: AppConfig.requestTimeout,
        sendTimeout: AppConfig.requestTimeout,
        headers: {'Accept': 'application/json'},
      );

  void _onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final auth = _session.authorizationHeader;
    if (auth != null && !_isPublic(options.path)) {
      options.headers['Authorization'] = auth;
    }
    handler.next(options);
  }

  bool _isPublic(String path) => _publicPaths.any(path.endsWith);

  Future<void> _onError(DioException error, ErrorInterceptorHandler handler) async {
    final request = error.requestOptions;
    final unauthorized = error.response?.statusCode == 401;
    if (!unauthorized || _isPublic(request.path) || request.extra['retried'] == true) {
      return handler.next(error);
    }

    // Une requête précédente a peut-être déjà renouvelé le jeton.
    final sentAuth = request.headers['Authorization'];
    final currentAuth = _session.authorizationHeader;
    if (currentAuth != null && sentAuth != currentAuth) {
      return _retry(request, currentAuth, handler, error);
    }

    final refreshed = await _refreshToken();
    if (refreshed == null) {
      onSessionExpired?.call();
      return handler.next(error);
    }
    return _retry(request, refreshed, handler, error);
  }

  Future<void> _retry(
    RequestOptions request,
    String auth,
    ErrorInterceptorHandler handler,
    DioException original,
  ) async {
    try {
      request.headers['Authorization'] = auth;
      request.extra['retried'] = true;
      final response = await _plain.fetch<dynamic>(request);
      handler.resolve(response);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) onSessionExpired?.call();
      handler.next(e);
    } catch (_) {
      handler.next(original);
    }
  }

  Future<String?> _refreshToken() async {
    final auth = _session.authorizationHeader;
    if (auth == null) return null;
    try {
      final response = await _plain.post<dynamic>(
        '/auth/refresh/',
        options: Options(headers: {'Authorization': auth}),
      );
      final data = response.data;
      final token = data is Map ? (data['token'] ?? data['access'])?.toString() : data?.toString();
      if (token == null || token.isEmpty) return null;
      await _session.updateToken(token);
      return _session.authorizationHeader;
    } catch (_) {
      return null;
    }
  }
}
