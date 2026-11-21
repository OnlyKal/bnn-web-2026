import 'package:dio/dio.dart';

import '../../core/config.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import '../models/encyclopedie.dart';
import 'rdc_online_source.dart';

/// Service de l'encyclopédie RDC.
///
/// Deux sources, mêmes formes de données :
/// - l'API BNN /api/bnn/rdc/ (contenus gérés dans l'administration Django) ;
/// - la source en ligne Wikidata + Wikipédia ([RdcOnlineSource]).
///
/// `--dart-define=RDC_SOURCE=api|online|auto` (défaut : auto). En mode auto,
/// l'API est sondée une fois ; si elle n'existe pas (404) ou ne répond pas,
/// la source en ligne prend le relais.
class EncyclopedieService {
  EncyclopedieService({Dio? dio, RdcOnlineSource? online})
      : _online = online ?? RdcOnlineSource(),
        _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.rdcApiUrl,
              connectTimeout: AppConfig.requestTimeout,
              receiveTimeout: AppConfig.requestTimeout,
              headers: {'Accept': 'application/json'},
            ));

  final Dio _dio;
  final RdcOnlineSource _online;
  static const pageSize = 20;
  static const _forcedSource = String.fromEnvironment('RDC_SOURCE', defaultValue: 'auto');
  Future<bool>? _onlineMode;

  /// `true` si les contenus viennent de Wikipédia / Wikidata.
  Future<bool> get isOnline => _onlineMode ??= _probe();

  Future<bool> _probe() async {
    if (_forcedSource == 'online') return true;
    if (_forcedSource == 'api') return false;
    try {
      final response = await _dio.get<dynamic>('/accueil/', options: Options(receiveTimeout: const Duration(seconds: 8)));
      _cache['/accueil/?'] = (DateTime.now(), response.data);
      return false;
    } catch (_) {
      return true;
    }
  }

  /// Appelle l'API ou la source en ligne et convertit les erreurs.
  Future<dynamic> _source(Future<dynamic> Function() online, Future<dynamic> Function() api) async {
    if (await isOnline) {
      try {
        return await online();
      } on ApiException {
        rethrow;
      } catch (e) {
        throw ApiException.from(e, fallback: 'Le chargement depuis Wikipédia / Wikidata a échoué.');
      }
    }
    return api();
  }
  static const _cacheTtl = Duration(minutes: 5);
  final Map<String, (DateTime, dynamic)> _cache = {};

  Future<dynamic> _get(String path, {Map<String, dynamic>? query, bool cached = false}) async {
    final params = {
      for (final e in (query ?? const <String, dynamic>{}).entries)
        if (e.value != null && '${e.value}'.isNotEmpty) e.key: e.value,
    };
    final key = '$path?${Uri(queryParameters: params.map((k, v) => MapEntry(k, '$v'))).query}';
    final hit = _cache[key];
    if (cached && hit != null && DateTime.now().difference(hit.$1) < _cacheTtl) return hit.$2;
    try {
      final response = await _dio.get<dynamic>(path, queryParameters: params);
      if (cached) _cache[key] = (DateTime.now(), response.data);
      return response.data;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        throw ApiException('Ce contenu est introuvable ou n’est plus publié.', statusCode: 404);
      }
      throw ApiException.from(e, fallback: 'Le chargement de l’encyclopédie a échoué.');
    }
  }

  Future<RdcAccueil> accueil() async =>
      RdcAccueil.fromJson(asJson(await _source(_online.accueil, () => _get('/accueil/', cached: true))) ?? {});

  Future<RdcFiltres> filtres() async =>
      RdcFiltres.fromJson(asJson(await _source(_online.filtres, () => _get('/filtres/', cached: true))) ?? {});

  Future<RdcCategorieDetail> categorie(String slug) async => RdcCategorieDetail.fromJson(
      asJson(await _source(() => _online.categorie(slug), () => _get('/categories/$slug/', cached: true))) ?? {});

  Future<RdcPage<RdcFiche>> fiches({
    String? q,
    String? categorie,
    String? province,
    String? nature,
    String? periode,
    String? ordering,
    bool vedette = false,
    int page = 1,
  }) async {
    final json = asJson(await _source(
          () => _online.fiches({
            'q': q?.trim(),
            'categorie': categorie,
            'province': province,
            'nature': nature,
            'periode': periode,
            'ordering': ordering,
            'vedette': vedette,
            'page': page,
          }),
          () => _get('/fiches/', query: {
            'q': q?.trim(),
            'categorie': categorie,
            'province': province,
            'nature': nature,
            'periode': periode,
            'ordering': ordering,
            'vedette': vedette ? '1' : null,
            'page': page,
            'page_size': pageSize,
          }),
        )) ??
        {};
    return RdcPage(
      items: extractList(json['results']).map(RdcFiche.fromJson).toList(),
      count: asInt(json['count']) ?? 0,
      page: asInt(json['page']) ?? page,
      totalPages: asInt(json['total_pages']) ?? 0,
    );
  }

  Future<RdcFicheDetail> fiche(String slug) async =>
      RdcFicheDetail.fromJson(asJson(await _source(() => _online.fiche(slug), () => _get('/fiches/$slug/'))) ?? {});

  Future<List<RdcProvince>> provinces() async => extractList(
          (asJson(await _source(_online.provinces, () => _get('/provinces/', cached: true))) ?? {})['results'])
      .map(RdcProvince.fromJson)
      .toList();

  Future<RdcProvinceDetail> province(String slug) async => RdcProvinceDetail.fromJson(
      asJson(await _source(() => _online.province(slug), () => _get('/provinces/$slug/'))) ?? {});

  Future<({List<RdcPeriode> periodes, List<RdcFiche> evenements, int count})> chronologie({
    String? periode,
    String? nature,
    String? categorie,
  }) async {
    final json = asJson(await _source(
          () => _online.chronologie({'periode': periode, 'nature': (nature ?? '').isEmpty ? null : nature, 'categorie': categorie}),
          () => _get('/chronologie/', query: {'periode': periode, 'nature': nature, 'categorie': categorie}),
        )) ??
        {};
    return (
      periodes: extractList(json['periodes']).map(RdcPeriode.fromJson).toList(),
      evenements: extractList(json['evenements']).map(RdcFiche.fromJson).toList(),
      count: asInt(json['count']) ?? 0,
    );
  }

  Future<List<RdcMapFeature>> carte({String? categorie, String? province, bool provinces = false}) async {
    final json = asJson(await _source(
          () => _online.carte({'categorie': categorie, 'province': province, 'provinces': provinces}),
          () => _get('/carte/', query: {
            'categorie': categorie,
            'province': province,
            'provinces': provinces ? '1' : null,
          }),
        )) ??
        {};
    return extractList(json['features']).map(RdcMapFeature.fromJson).toList();
  }
}
