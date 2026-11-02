import 'package:dio/dio.dart';

import '../../core/config.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import '../models/ressource.dart';

class HalDocumentType {
  const HalDocumentType(this.code, this.label);

  final String code;
  final String label;

  static const all = [
    HalDocumentType('ART', 'Article scientifique'),
    HalDocumentType('OUV', 'Ouvrage'),
    HalDocumentType('THESE', 'Thèse'),
    HalDocumentType('HDR', 'Habilitation à diriger des recherches'),
    HalDocumentType('COMM', 'Communication dans un congrès'),
    HalDocumentType('COUV', "Chapitre d'ouvrage"),
    HalDocumentType('REPORT', 'Rapport'),
    HalDocumentType('MEM', 'Mémoire'),
  ];
}

class HalDomain {
  HalDomain({required this.code, required this.name, required this.label});

  factory HalDomain.fromJson(dynamic json) {
    if (json is String) return HalDomain(code: json, name: json, label: json);
    final map = json is Map ? Map<String, dynamic>.from(json) : <String, dynamic>{};
    final name = Ressource.halDomainName(map);
    return HalDomain(
      code: pickString(map, ['code', 'id', 'name', 'label']) ?? name,
      name: name,
      label: pickString(map, ['label']) ?? name,
    );
  }

  final String code;
  final String name;
  final String label;
}

/// Filtres de recherche HAL (identiques au Web).
class HalFilters {
  const HalFilters({
    this.q = '',
    this.title = '',
    this.author = '',
    this.keywords = '',
    this.year = '',
    this.domain = '',
    this.language = '',
    this.docType = '',
    this.hasFile = true,
  });

  final String q;
  final String title;
  final String author;
  final String keywords;
  final String year;
  final String domain;
  final String language;
  final String docType;
  final bool hasFile;

  HalFilters copyWith({
    String? q,
    String? title,
    String? author,
    String? keywords,
    String? year,
    String? domain,
    String? language,
    String? docType,
    bool? hasFile,
  }) =>
      HalFilters(
        q: q ?? this.q,
        title: title ?? this.title,
        author: author ?? this.author,
        keywords: keywords ?? this.keywords,
        year: year ?? this.year,
        domain: domain ?? this.domain,
        language: language ?? this.language,
        docType: docType ?? this.docType,
        hasFile: hasFile ?? this.hasFile,
      );

  int get advancedCount =>
      [title, author, keywords, year].where((e) => e.trim().isNotEmpty).length + (hasFile ? 0 : 1);

  Map<String, dynamic> toQuery() => {
        if (q.trim().isNotEmpty) 'q': q.trim(),
        if (title.trim().isNotEmpty) 'title': title.trim(),
        if (author.trim().isNotEmpty) 'author': author.trim(),
        if (keywords.trim().isNotEmpty) 'keywords': keywords.trim(),
        if (year.trim().isNotEmpty) 'year': year.trim(),
        if (domain.isNotEmpty) 'domain': domain,
        if (language.isNotEmpty) 'language': language,
        if (docType.isNotEmpty) 'doc_type': docType,
        'has_file': hasFile ? 'true' : 'false',
      };
}

class HalPage {
  HalPage({required this.items, required this.total});

  final List<Ressource> items;
  final int total;
}

/// Ressources externes HAL via le proxy BNN (`/api/hal/`), sans authentification.
class HalService {
  HalService({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.halApiUrl,
              connectTimeout: AppConfig.halTimeout,
              receiveTimeout: AppConfig.halTimeout,
              headers: {'Accept': 'application/json'},
            ));

  final Dio _dio;
  static const pageSize = 10;

  Future<Json> _get(String path, [Map<String, dynamic>? params]) async {
    try {
      final response = await _dio.get<dynamic>(path, queryParameters: params);
      final data = response.data;
      if (data is! Map) throw ApiException('Le service HAL a retourné une réponse illisible.');
      final map = Map<String, dynamic>.from(data);
      if (map['success'] == false) {
        throw ApiException(pickString(map, ['error']) ?? 'Le service HAL est momentanément indisponible.');
      }
      return map;
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
        throw ApiException('La requête HAL a pris trop de temps. Veuillez réessayer.');
      }
      if (e.type == DioExceptionType.connectionError) {
        throw ApiException('Impossible de joindre le service HAL. Vérifiez votre connexion et réessayez.');
      }
      if (e.response?.statusCode == 404) {
        throw ApiException('Cette ressource HAL est introuvable.', statusCode: 404);
      }
      throw ApiException.from(e, fallback: 'Le service HAL est momentanément indisponible.');
    }
  }

  /// Filtres par défaut proposés par le serveur.
  Future<HalFilters> defaultFilters() async {
    final meta = await _get('/meta/');
    final defaults = asJson(meta['default_filters']) ?? const {};
    final docType = pickString(defaults, ['doc_type']) ?? '';
    return HalFilters(
      language: pickString(defaults, ['language']) ?? '',
      docType: HalDocumentType.all.any((t) => t.code == docType) ? docType : '',
      hasFile: true,
    );
  }

  Future<HalPage> ouvrages(HalFilters filters, {int page = 1, int size = pageSize}) async {
    final data = await _get('/ouvrages/', {...filters.toQuery(), 'page': page, 'page_size': size});
    final results = data['results'] is List ? data['results'] as List : const [];
    return HalPage(
      items: results.whereType<Map>().map((e) => Ressource.fromHal(Map<String, dynamic>.from(e))).toList(),
      total: asInt(data['total']) ?? 0,
    );
  }

  Future<int> totalCount() async {
    final data = await _get('/ouvrages/', {'page_size': 1});
    return asInt(data['total']) ?? 0;
  }

  Future<Ressource> ouvrage(String identifier) async {
    final data = await _get('/ouvrages/${Uri.encodeComponent(identifier)}/');
    final result = asJson(data['result']);
    if (result == null) throw ApiException('Cette ressource HAL ne contient pas de données consultables.');
    return Ressource.fromHal(result);
  }

  Future<List<HalDomain>> domaines({String language = '', String docType = ''}) async {
    final data = await _get('/domaines/', {
      if (language.isNotEmpty) 'language': language,
      if (docType.isNotEmpty) 'doc_type': docType,
      'limit': 100,
    });
    final results = data['results'] is List ? data['results'] as List : const [];
    return results.map(HalDomain.fromJson).where((d) => d.code.isNotEmpty).toList();
  }
}
