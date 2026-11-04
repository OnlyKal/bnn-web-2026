import 'package:dio/dio.dart';

import '../../core/config.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import '../models/openalex.dart';

/// Rubriques du catalogue OpenAlex (une route serveur par rubrique).
enum OpenAlexCatalog {
  all('/search/', 'Tout', null),
  books('/books/', 'Livres', 'book'),
  chapters('/book-chapters/', 'Chapitres', 'book-chapter'),
  articles('/articles/', 'Articles', 'article');

  const OpenAlexCatalog(this.path, this.label, this.type);

  final String path;
  final String label;

  /// Type OpenAlex correspondant, pour le catalogue PDF (`/pdfs/?type=`).
  final String? type;
}

/// Niveaux de classement OpenAlex utilisés pour le filtrage par domaine.
enum OpenAlexCategoryLevel {
  domain('domain', 'Domaine'),
  field('field', 'Discipline'),
  subfield('subfield', 'Sous-discipline');

  const OpenAlexCategoryLevel(this.param, this.label);

  /// Nom du paramètre serveur (`domain`, `field`, `subfield`).
  final String param;
  final String label;

  OpenAlexCategoryLevel? get next => switch (this) {
        domain => field,
        field => subfield,
        subfield => null,
      };

  static OpenAlexCategoryLevel? fromParam(String? value) {
    for (final level in values) {
      if (level.param == value) return level;
    }
    return null;
  }
}

/// Catégorie sélectionnée (un maillon du fil d'Ariane domaine › discipline › sous-discipline).
class OpenAlexCategoryRef {
  const OpenAlexCategoryRef({required this.level, required this.id, required this.name});

  final OpenAlexCategoryLevel level;
  final String id;
  final String name;

  /// Nom affiché : traduit pour les domaines et disciplines, sinon nom OpenAlex.
  String get label => openAlexCategoryLabel(level, id, name);

  @override
  bool operator ==(Object other) => other is OpenAlexCategoryRef && other.level == level && other.id == id;

  @override
  int get hashCode => Object.hash(level, id);
}

/// Catégorie renvoyée par `/pdfs/categories/`, avec son nombre de PDF.
class OpenAlexCategory {
  const OpenAlexCategory({required this.ref, required this.count});

  final OpenAlexCategoryRef ref;
  final int count;
}

class OpenAlexCategoryPage {
  const OpenAlexCategoryPage({required this.level, required this.items, required this.total, required this.truncated});

  final OpenAlexCategoryLevel level;
  final List<OpenAlexCategory> items;
  final int total;

  /// Plus de 200 catégories : seules les plus fournies sont renvoyées.
  final bool truncated;
}

const _domainLabels = {
  '1': 'Sciences de la vie',
  '2': 'Sciences sociales',
  '3': 'Sciences physiques',
  '4': 'Sciences de la santé',
};

const _fieldLabels = {
  '11': 'Agriculture et sciences biologiques',
  '12': 'Arts et sciences humaines',
  '13': 'Biochimie, génétique et biologie moléculaire',
  '14': 'Gestion, management et comptabilité',
  '15': 'Génie chimique',
  '16': 'Chimie',
  '17': 'Informatique',
  '18': 'Sciences de la décision',
  '19': 'Sciences de la Terre et des planètes',
  '20': 'Économie, économétrie et finance',
  '21': 'Énergie',
  '22': 'Ingénierie',
  '23': 'Sciences de l’environnement',
  '24': 'Immunologie et microbiologie',
  '25': 'Science des matériaux',
  '26': 'Mathématiques',
  '27': 'Médecine',
  '28': 'Neurosciences',
  '29': 'Soins infirmiers',
  '30': 'Pharmacologie, toxicologie et pharmacie',
  '31': 'Physique et astronomie',
  '32': 'Psychologie',
  '33': 'Sciences sociales',
  '34': 'Médecine vétérinaire',
  '35': 'Odontologie',
  '36': 'Professions de santé',
};

/// Libellé français d'une catégorie (les sous-disciplines gardent le nom OpenAlex).
String openAlexCategoryLabel(OpenAlexCategoryLevel level, String id, String name) => switch (level) {
      OpenAlexCategoryLevel.domain => _domainLabels[id] ?? name,
      OpenAlexCategoryLevel.field => _fieldLabels[id] ?? name,
      OpenAlexCategoryLevel.subfield => name,
    };

/// Tris proposés (`relevance` exige un texte recherché).
class OpenAlexSort {
  OpenAlexSort._();

  static const options = [
    ('', 'Par défaut'),
    ('relevance', 'Pertinence'),
    ('publication_year', 'Plus récents'),
    ('cited_by_count', 'Plus cités'),
  ];
}

/// Filtres de recherche OpenAlex (paramètres de `/books/`, `/articles/`, `/search/`…).
class OpenAlexFilters {
  const OpenAlexFilters({
    this.search = '',
    this.language = '',
    this.yearFrom = '',
    this.yearTo = '',
    this.openAccessOnly = false,
    this.pdfOnly = true,
    this.author = '',
    this.sort = '',
    this.categories = const [],
  });

  final String search;
  final String language;
  final String yearFrom;
  final String yearTo;
  final bool openAccessOnly;

  /// Uniquement les publications dont le PDF est lisible dans la BNN (hébergé par OpenAlex).
  final bool pdfOnly;
  final String author;
  final String sort;

  /// Fil d'Ariane du domaine choisi (domaine › discipline › sous-discipline), vide = tous.
  /// N'est applicable qu'au catalogue PDF (`/pdfs/`), donc avec [pdfOnly].
  final List<OpenAlexCategoryRef> categories;

  OpenAlexCategoryRef? get category => categories.isEmpty ? null : categories.last;

  OpenAlexFilters copyWith({
    String? search,
    String? language,
    String? yearFrom,
    String? yearTo,
    bool? openAccessOnly,
    bool? pdfOnly,
    String? author,
    String? sort,
    List<OpenAlexCategoryRef>? categories,
  }) =>
      OpenAlexFilters(
        search: search ?? this.search,
        language: language ?? this.language,
        yearFrom: yearFrom ?? this.yearFrom,
        yearTo: yearTo ?? this.yearTo,
        openAccessOnly: openAccessOnly ?? this.openAccessOnly,
        pdfOnly: pdfOnly ?? this.pdfOnly,
        author: author ?? this.author,
        sort: sort ?? this.sort,
        categories: categories ?? this.categories,
      );

  /// Avec [pdfOnly], la liste passe par le catalogue PDF (`/pdfs/`), seul à accepter
  /// le filtrage par domaine ; sinon par la route de la rubrique (`/books/`…).
  bool get usesPdfCatalog => pdfOnly;

  String pathFor(OpenAlexCatalog catalog) => usesPdfCatalog ? '/pdfs/' : catalog.path;

  /// Filtres communs à la liste et aux comptes par catégorie.
  Map<String, dynamic> _common(OpenAlexCatalog catalog) {
    final text = search.trim();
    return {
      if (text.isNotEmpty) ((usesPdfCatalog || catalog == OpenAlexCatalog.all) ? 'q' : 'search'): text,
      if (usesPdfCatalog && catalog.type != null) 'type': catalog.type,
      if (language.isNotEmpty) 'language': language,
      if (yearFrom.trim().isNotEmpty) 'year_from': yearFrom.trim(),
      if (yearTo.trim().isNotEmpty) 'year_to': yearTo.trim(),
      if (openAccessOnly) 'open_access': 'true',
      if (author.trim().isNotEmpty) 'author': author.trim(),
    };
  }

  Map<String, dynamic> toQuery(OpenAlexCatalog catalog) {
    // « Pertinence » n'a de sens (et n'est accepté) qu'avec un texte recherché.
    final effectiveSort = sort == 'relevance' && search.trim().isEmpty ? '' : sort;
    return {
      ..._common(catalog),
      // has_pdf est implicite sur /pdfs/ (et has_pdf=false y est refusé).
      if (pdfOnly && !usesPdfCatalog) 'has_pdf': 'true',
      if (usesPdfCatalog)
        for (final c in categories) c.level.param: c.id,
      if (effectiveSort.isNotEmpty) ...{'sort': effectiveSort, 'order': 'desc'},
    };
  }

  /// Paramètres de `/pdfs/categories/` pour lister les sous-catégories de [parents].
  Map<String, dynamic> toCategoriesQuery(OpenAlexCatalog catalog, List<OpenAlexCategoryRef> parents) => {
        ..._common(catalog),
        for (final c in parents) c.level.param: c.id,
      };
}

/// Bibliothèque OpenAlex via le serveur BNN (`/api/v1/openalex/`), sans jeton.
/// L'application n'appelle jamais api.openalex.org directement.
class OpenAlexService {
  OpenAlexService({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.openAlexApiUrl,
              connectTimeout: AppConfig.openAlexTimeout,
              receiveTimeout: AppConfig.openAlexTimeout,
              headers: {'Accept': 'application/json'},
            ));

  final Dio _dio;
  static const pageSize = 20;

  /// Message français associé à un code d'erreur du serveur (section « Codes d'erreur »).
  static String messageFor(String? code, {String? details, int? retryAfter}) => switch (code) {
        'INVALID_PARAMETER' => details ?? 'Un des filtres est invalide. Vérifiez votre saisie.',
        'OPENALEX_BAD_REQUEST' => 'OpenAlex n’a pas pu traiter cette recherche. Simplifiez-la et réessayez.',
        'OPENALEX_NOT_FOUND' => 'Cette publication est introuvable sur OpenAlex.',
        'PDF_NOT_AVAILABLE' => 'Le PDF de cette publication n’est pas disponible sur OpenAlex.',
        'RATE_LIMITED' => retryAfter != null
            ? 'Trop de requêtes. Réessayez dans $retryAfter seconde${retryAfter > 1 ? 's' : ''}.'
            : 'Trop de requêtes. Patientez quelques instants avant de réessayer.',
        'OPENALEX_RATE_LIMITED' => 'Service momentanément saturé, réessayez plus tard.',
        'OPENALEX_TIMEOUT' => 'OpenAlex n’a pas répondu à temps. Veuillez réessayer.',
        'OPENALEX_NOT_CONFIGURED' =>
          'La bibliothèque OpenAlex n’est pas encore configurée. Veuillez prévenir l’administrateur.',
        _ => 'La bibliothèque OpenAlex est momentanément indisponible. Veuillez réessayer.',
      };

  static ApiException _toException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return ApiException(messageFor('OPENALEX_TIMEOUT'));
      case DioExceptionType.connectionError:
        return ApiException('Impossible de joindre la bibliothèque OpenAlex. Vérifiez votre connexion et réessayez.');
      case DioExceptionType.cancel:
        return ApiException('Requête annulée.');
      default:
        break;
    }
    final response = e.response;
    final body = asJson(response?.data);
    final error = asJson(body?['error']);
    final retryAfter = int.tryParse(response?.headers.value('retry-after') ?? '');
    return ApiException(
      messageFor(pickString(error, ['code']), details: pickString(error, ['details']), retryAfter: retryAfter),
      statusCode: response?.statusCode,
    );
  }

  Future<Json> _get(String path, [Map<String, dynamic>? params]) async {
    try {
      final response = await _dio.get<dynamic>(path, queryParameters: params);
      final data = asJson(response.data);
      if (data == null) throw ApiException(messageFor('OPENALEX_INVALID_RESPONSE'));
      if (data['success'] == false) {
        final error = asJson(data['error']);
        throw ApiException(messageFor(pickString(error, ['code']), details: pickString(error, ['details'])));
      }
      return data;
    } on DioException catch (e) {
      throw _toException(e);
    }
  }

  /// Liste paginée d'une rubrique du catalogue.
  Future<OpenAlexPage> works(
    OpenAlexCatalog catalog,
    OpenAlexFilters filters, {
    int page = 1,
    int perPage = pageSize,
  }) async {
    final data = await _get(filters.pathFor(catalog), {...filters.toQuery(catalog), 'page': page, 'per_page': perPage});
    final pagination = asJson(data['pagination']) ?? const {};
    final results = data['results'] is List ? data['results'] as List : const [];
    return OpenAlexPage(
      items: results.whereType<Map>().map((e) => OpenAlexWork.fromJson(Map<String, dynamic>.from(e))).toList(),
      total: asInt(pagination['total']) ?? 0,
      page: asInt(pagination['page']) ?? page,
      hasNext: pagination['has_next'] == true,
      maxAccessiblePage: asInt(pagination['max_accessible_page']) ?? page,
    );
  }

  /// Nombre total de publications avec PDF (catalogue `/pdfs/` sans filtre).
  Future<int> totalCount() async {
    final data = await _get('/pdfs/', {'page': 1, 'per_page': 1});
    return asInt(asJson(data['pagination'])?['total']) ?? 0;
  }

  /// Sous-catégories de [parents] (domaines si vide) avec le nombre de PDF de chacune,
  /// selon les filtres courants. Les publications sans catégorie connue sont ignorées.
  Future<OpenAlexCategoryPage> categories(
    OpenAlexCatalog catalog,
    OpenAlexFilters filters, {
    List<OpenAlexCategoryRef> parents = const [],
  }) async {
    final data = await _get('/pdfs/categories/', filters.toCategoriesQuery(catalog, parents));
    final level = OpenAlexCategoryLevel.fromParam(pickString(data, ['group'])) ??
        (parents.isEmpty ? OpenAlexCategoryLevel.domain : parents.last.level.next ?? OpenAlexCategoryLevel.subfield);
    final results = data['results'] is List ? data['results'] as List : const [];
    final items = <OpenAlexCategory>[];
    for (final raw in results.whereType<Map>()) {
      final json = Map<String, dynamic>.from(raw);
      final id = pickString(json, ['id']);
      final name = pickString(json, ['name']);
      if (id == null || name == null) continue;
      items.add(OpenAlexCategory(
        ref: OpenAlexCategoryRef(level: level, id: id, name: name),
        count: asInt(json['count']) ?? 0,
      ));
    }
    return OpenAlexCategoryPage(
      level: level,
      items: items,
      total: asInt(data['total']) ?? 0,
      truncated: data['truncated'] == true,
    );
  }

  /// Notice complète d'une publication (`W…`).
  Future<OpenAlexWork> work(String id) async {
    final data = await _get('/works/${Uri.encodeComponent(id)}/');
    final json = asJson(data['data']);
    if (json == null) throw ApiException(messageFor('OPENALEX_INVALID_RESPONSE'));
    return OpenAlexWork.fromJson(json);
  }

  /// Mode d'accès au document, à consulter AVANT d'ouvrir le lecteur PDF.
  Future<OpenAlexPdfInfo> pdfInfo(String id) async {
    final data = await _get('/works/${Uri.encodeComponent(id)}/pdf-info/');
    return OpenAlexPdfInfo.fromJson(asJson(data['data']) ?? const {});
  }
}
