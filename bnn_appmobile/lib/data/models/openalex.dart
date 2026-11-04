import '../../core/utils/json_utils.dart';

/// Libellés français des types de documents OpenAlex.
String openAlexTypeLabel(String? type) => switch (type) {
      'book' => 'Livre',
      'book-chapter' => 'Chapitre de livre',
      'article' => 'Article',
      'review' => 'Revue de littérature',
      'preprint' => 'Prépublication',
      'dissertation' => 'Thèse',
      'report' => 'Rapport',
      'dataset' => 'Jeu de données',
      'conference-paper' => 'Communication',
      'editorial' => 'Éditorial',
      'letter' => 'Lettre',
      'reference-entry' => 'Notice de référence',
      _ => 'Publication',
    };

/// Libellé d'une langue (codes ISO 639-1).
String openAlexLanguageLabel(String? code) => switch ((code ?? '').toLowerCase()) {
      'fr' => 'Français',
      'en' => 'Anglais',
      'es' => 'Espagnol',
      'pt' => 'Portugais',
      'de' => 'Allemand',
      'it' => 'Italien',
      '' => '',
      final other => other.toUpperCase(),
    };

/// Libellé du statut de libre accès.
String openAlexOaStatusLabel(String? status) => switch (status) {
      'gold' => 'Or (revue en libre accès)',
      'green' => 'Vert (dépôt en archive ouverte)',
      'hybrid' => 'Hybride',
      'bronze' => 'Bronze (lecture libre)',
      'diamond' => 'Diamant (sans frais)',
      'closed' => 'Accès restreint',
      _ => status ?? '',
    };

List<Json> _maps(dynamic value) =>
    value is List ? value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];

List<String> _strings(dynamic value) =>
    value is List ? value.where((e) => e != null).map((e) => e.toString()).where((e) => e.isNotEmpty).toList() : const [];

class OpenAlexAuthor {
  const OpenAlexAuthor({required this.name, this.id, this.institutions = const []});

  factory OpenAlexAuthor.fromJson(Json json) => OpenAlexAuthor(
        id: pickString(json, ['id']),
        name: pickString(json, ['name']) ?? 'Auteur inconnu',
        institutions: _maps(json['institutions']).map((i) => pickString(i, ['name'])).whereType<String>().toList(),
      );

  final String? id;
  final String name;
  final List<String> institutions;
}

/// Publication OpenAlex (livre, chapitre, article…), telle que normalisée par le serveur BNN.
class OpenAlexWork {
  OpenAlexWork({
    required this.id,
    required this.title,
    this.type,
    this.doi,
    this.year,
    this.date,
    this.language,
    this.authors = const [],
    this.publisher,
    this.sourceName,
    this.abstract,
    this.domain,
    this.field,
    this.subfield,
    this.topic,
    this.keywords = const [],
    this.openAccess,
    this.oaStatus,
    this.license,
    this.citedByCount = 0,
    this.landingPageUrl,
    this.externalPdfUrl,
    this.pdfAvailable = false,
    this.pdfUrl,
    this.openAlexUrl,
    this.isRetracted = false,
    this.biblio = const {},
  });

  factory OpenAlexWork.fromJson(Json json) {
    final category = asJson(json['category']);
    String? catName(String key) => pickString(asJson(category?[key]), ['name']);
    final source = asJson(json['publication_source']);
    final oa = asJson(json['open_access_details']);
    final openAccess = json['open_access'];
    return OpenAlexWork(
      id: pickString(json, ['id']) ?? '',
      title: pickString(json, ['title']) ?? 'Titre non disponible',
      type: pickString(json, ['type']),
      doi: pickString(json, ['doi']),
      year: asInt(json['publication_year']),
      date: pickString(json, ['publication_date']),
      language: pickString(json, ['language']),
      authors: _maps(json['authors']).map(OpenAlexAuthor.fromJson).toList(),
      publisher: pickString(json, ['publisher']) ?? pickString(source, ['publisher']),
      sourceName: pickString(source, ['name']),
      abstract: pickString(json, ['abstract']),
      domain: catName('domain'),
      field: catName('field'),
      subfield: catName('subfield'),
      topic: catName('topic'),
      keywords: _strings(json['keywords']),
      openAccess: openAccess is bool ? openAccess : null,
      oaStatus: pickString(oa, ['oa_status']),
      license: pickString(json, ['license']),
      citedByCount: asInt(json['cited_by_count']) ?? 0,
      landingPageUrl: pickString(json, ['landing_page_url']),
      externalPdfUrl: pickString(json, ['external_pdf_url']),
      pdfAvailable: json['openalex_pdf_available'] == true,
      pdfUrl: pickString(json, ['openalex_pdf_url']),
      openAlexUrl: pickString(json, ['openalex_url']),
      isRetracted: json['is_retracted'] == true,
      biblio: asJson(json['biblio']) ?? const {},
    );
  }

  final String id;
  final String title;
  final String? type;
  final String? doi;
  final int? year;
  final String? date;
  final String? language;
  final List<OpenAlexAuthor> authors;
  final String? publisher;
  final String? sourceName;
  final String? abstract;
  final String? domain;
  final String? field;
  final String? subfield;
  final String? topic;
  final List<String> keywords;
  final bool? openAccess;
  final String? oaStatus;
  final String? license;
  final int citedByCount;
  final String? landingPageUrl;
  final String? externalPdfUrl;
  final bool pdfAvailable;
  final String? pdfUrl;
  final String? openAlexUrl;
  final bool isRetracted;
  final Json biblio;

  String get typeLabel => openAlexTypeLabel(type);
  String get languageLabel => openAlexLanguageLabel(language);
  String get authorsLabel => authors.map((a) => a.name).join(', ');

  /// Classement thématique (domaine › discipline › sous-discipline).
  String? get categoryLabel {
    final parts = [domain, field, subfield].whereType<String>().toList();
    return parts.isEmpty ? null : parts.join(' › ');
  }

  String? get doiUrl => doi == null ? null : 'https://doi.org/$doi';
}

/// Comment accéder au document d'une publication (`/pdf-info/`).
enum OpenAlexAccess { openAlexProxy, externalLink, landingPage, unavailable }

class OpenAlexPdfInfo {
  const OpenAlexPdfInfo({
    required this.access,
    this.pdfUrl,
    this.externalPdfUrl,
    this.landingPageUrl,
    this.license,
    this.cachedOnServer = false,
  });

  factory OpenAlexPdfInfo.fromJson(Json json) {
    final access = switch (pickString(json, ['download_method'])) {
      'openalex_proxy' => OpenAlexAccess.openAlexProxy,
      'external_link' => OpenAlexAccess.externalLink,
      'landing_page' => OpenAlexAccess.landingPage,
      _ => OpenAlexAccess.unavailable,
    };
    return OpenAlexPdfInfo(
      access: access,
      pdfUrl: pickString(json, ['openalex_pdf_url']),
      externalPdfUrl: pickString(json, ['external_pdf_url']),
      landingPageUrl: pickString(json, ['landing_page_url']),
      license: pickString(json, ['license']),
      cachedOnServer: json['cached_on_server'] == true,
    );
  }

  final OpenAlexAccess access;
  final String? pdfUrl;
  final String? externalPdfUrl;
  final String? landingPageUrl;
  final String? license;
  final bool cachedOnServer;
}

class OpenAlexPage {
  const OpenAlexPage({
    required this.items,
    required this.total,
    required this.page,
    required this.hasNext,
    required this.maxAccessiblePage,
  });

  final List<OpenAlexWork> items;
  final int total;
  final int page;
  final bool hasNext;
  final int maxAccessiblePage;
}
