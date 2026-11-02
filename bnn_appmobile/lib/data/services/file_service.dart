import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../core/config.dart';
import '../../core/network/api_exception.dart';
import '../../core/storage/session_storage.dart';

/// Téléchargement en mémoire des documents à consulter (aucune copie n'est
/// enregistrée sur l'appareil : la plateforme est dédiée à la consultation).
class FileService {
  FileService(this._session, {Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              connectTimeout: AppConfig.requestTimeout,
              receiveTimeout: const Duration(minutes: 5),
              responseType: ResponseType.bytes,
              followRedirects: true,
            ));

  final SessionStorage _session;
  final Dio _dio;

  /// En-têtes d'authentification pour les fichiers hébergés par la BNN.
  Map<String, String> authHeadersFor(String url) {
    final auth = _session.authorizationHeader;
    if (auth == null || !url.startsWith(AppConfig.apiServerUrl)) return const {};
    return {'Authorization': auth};
  }

  Future<Uint8List> fetch(
    String url, {
    void Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    Future<Uint8List> attempt(Map<String, String> headers) async {
      final response = await _dio.get<List<int>>(
        url,
        options: Options(headers: {'Accept': '*/*', ...headers}),
        cancelToken: cancelToken,
        onReceiveProgress: (received, total) {
          if (total > 0) onProgress?.call(received / total);
        },
      );
      final data = response.data;
      if (data == null || data.isEmpty) throw ApiException('Le fichier reçu est vide.');
      return Uint8List.fromList(data);
    }

    final headers = authHeadersFor(url);
    try {
      return await attempt(headers);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) rethrow;
      // Repli sans authentification (fichiers publics), comme le Web.
      if (headers.isNotEmpty) {
        try {
          return await attempt(const {});
        } catch (_) {}
      }
      throw ApiException.from(e, fallback: 'Impossible de charger le fichier.');
    }
  }

  static bool isPdf(Uint8List bytes) =>
      bytes.length > 4 && String.fromCharCodes(bytes.sublist(0, 5)).startsWith('%PDF');

  static bool isZip(Uint8List bytes) => bytes.length > 100 && bytes[0] == 0x50 && bytes[1] == 0x4B;
}
