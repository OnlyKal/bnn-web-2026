import 'package:dio/dio.dart';

import '../../core/config.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import '../models/consultation_stats.dart';

/// Paramètres communs : sources et période.
class ConsultationQuery {
  const ConsultationQuery({required this.sources, this.period, this.dateDebut, this.dateFin});

  /// Codes des sources ; vide ou complet = toutes les sources.
  final List<String> sources;
  final String? period;
  final String? dateDebut;
  final String? dateFin;

  Map<String, dynamic> toQuery() => {
        if (sources.isNotEmpty && sources.length < ConsultationSource.all.length) 'source': sources.join(','),
        if (period != null) 'periode': period,
        if (period == ConsultationPeriod.intervalle.code) ...{
          'date_debut': dateDebut,
          'date_fin': dateFin,
        },
      };
}

/// API publique des consultations périodiques (aucune authentification).
class ConsultationsService {
  ConsultationsService({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.consultationsApiUrl,
              connectTimeout: AppConfig.requestTimeout,
              receiveTimeout: AppConfig.requestTimeout,
              headers: {'Accept': 'application/json'},
            ));

  final Dio _dio;

  Future<Json> _get(String path, Map<String, dynamic> params, String fallback, CancelToken? cancelToken) async {
    try {
      final response = await _dio.get<dynamic>(path, queryParameters: params, cancelToken: cancelToken);
      final data = asJson(response.data);
      if (data == null) throw ApiException(fallback);
      if (data['success'] == false) throw ApiException(_message(data) ?? fallback);
      return data;
    } on DioException catch (e) {
      final data = asJson(e.response?.data);
      final message = data == null ? null : _message(data);
      if (message != null) throw ApiException(message, statusCode: e.response?.statusCode);
      throw ApiException.from(e, fallback: fallback);
    }
  }

  static String? _message(Json data) {
    final message = data['message']?.toString();
    final details = asJson(data['error'])?['details']?.toString();
    if (message == null) return details;
    return details == null ? message : '$message : $details';
  }

  /// Résumé des 4 périodes + diagnostic du suivi.
  Future<ConsultationSummary> summary(List<String> sources, {CancelToken? cancelToken}) async {
    final data = await _get(
      '/statistiques/',
      ConsultationQuery(sources: sources).toQuery(),
      'Erreur lors du chargement du résumé des consultations',
      cancelToken,
    );
    return ConsultationSummary.fromJson(data);
  }

  /// Statistiques détaillées d'une période.
  Future<ConsultationStats> statistics(ConsultationQuery query, {CancelToken? cancelToken}) async {
    final data = await _get(
      '/statistiques/',
      query.toQuery(),
      'Erreur lors du chargement des statistiques de consultation',
      cancelToken,
    );
    return ConsultationStats.fromJson(data);
  }

  /// Liste détaillée et paginée.
  Future<ConsultationPage> list(
    ConsultationQuery query, {
    String? action,
    String? resourceId,
    int page = 1,
    int pageSize = 20,
    CancelToken? cancelToken,
  }) async {
    final data = await _get(
      '/',
      {
        ...query.toQuery(),
        if (action != null && action.isNotEmpty) 'action': action,
        if (resourceId != null && resourceId.isNotEmpty) 'ressource_id': resourceId,
        'page': page,
        'page_size': pageSize,
      },
      'Erreur lors du chargement des consultations',
      cancelToken,
    );
    final results = data['results'] is List ? data['results'] as List : const [];
    return ConsultationPage(
      count: asInt(data['count']) ?? 0,
      items: results.whereType<Map>().map((e) => ConsultationEntry.fromJson(Map<String, dynamic>.from(e))).toList(),
      hasNext: data['next'] != null,
    );
  }
}
