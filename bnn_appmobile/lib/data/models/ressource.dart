import '../../core/config.dart';
import '../../core/utils/json_utils.dart';

/// Types de ressources reconnus par le backend (mêmes libellés que le Web).
class ResourceTypes {
  ResourceTypes._();

  static const labels = <String, String>{
    'livre': 'Livre',
    'monographie': 'Monographie',
    'article': 'Article',
    'these': 'Thèse / Mémoire',
    'rapport': 'Rapport',
    'revue': 'Revue',
    'conference': 'Acte de conférence',
    'audio': 'Audio',
    'video': 'Vidéo',
    'image': 'Image',
    'podcast': 'Podcast',
    'cours': 'Cours',
    'presentation': 'Présentation',
    'document': 'Document',
    'logiciel': 'Logiciel / Application',
  };

  static List<String> get all => labels.keys.toList();

  static String label(String? type) {
    if (type == null || type.isEmpty) return 'Ressource';
    return labels[type.toLowerCase().trim()] ?? type[0].toUpperCase() + type.substring(1);
  }
}

/// Lecteurs intégrés disponibles.
enum ReadableKind { pdf, epub, video, other }

class RessourceFichier {
  RessourceFichier({
    required this.id,
    required this.titre,
    required this.path,
    this.format,
    this.duree,
    this.taille,
  });

  factory RessourceFichier.fromJson(Json json) => RessourceFichier(
        id: pickString(json, ['id']),
        titre: pickString(json, ['titre', 'nom']),
        path: pickString(json, ['fichier', 'url', 'file']),
        format: pickString(json, ['format']),
        duree: pickString(json, ['duree']),
        taille: pickString(json, ['taille']),
      );

  final String? id;
  final String? titre;
  final String? path;
  final String? format;
  final String? duree;
  final String? taille;

  String? get url => AppConfig.mediaUrl(path);

  String? get fileName {
    final value = path;
    if (value == null) return null;
    return Uri.decodeComponent(value.split('?').first.split('/').last);
  }

  /// Détermine le lecteur adapté (même logique que `getReadableType` du Web).
  ReadableKind readableKind([String? fallbackFormat]) {
    final rawFormat = (format ?? fallbackFormat ?? '').toLowerCase().trim().replaceAll('.', '');
    final cleanPath = (path ?? '').split('?').first.toLowerCase();
    if (rawFormat == 'pdf' || rawFormat == 'application/pdf' || cleanPath.endsWith('.pdf')) {
      return ReadableKind.pdf;
    }
    if (rawFormat == 'epub' || rawFormat == 'application/epub+zip' || cleanPath.endsWith('.epub')) {
      return ReadableKind.epub;
    }
    const videos = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'];
    if (videos.contains(rawFormat) || videos.any((ext) => cleanPath.endsWith('.$ext'))) {
      return ReadableKind.video;
    }
    return ReadableKind.other;
  }

  Json toJson() => {
        'id': id,
        'titre': titre,
        'fichier': path,
        'format': format,
        'duree': duree,
        'taille': taille,
      };
}

/// Ressource documentaire (interne BNN ou externe HAL).
class Ressource {
  Ressource({
    required this.id,
    required this.titre,
    this.sousTitre,
    this.description,
    this.auteurs,
    this.edition,
    this.lieuEdition,
    this.isbn,
    this.langue,
    this.pays,
    this.domaineId,
    this.domaineNom,
    this.sousDomaineNom,
    this.type,
    this.format,
    this.datePublication,
    this.couverture,
    this.fichiers = const [],
    this.isExternal = false,
    this.halId,
    this.keywords = const [],
    this.sourceUrl,
  });

  factory Ressource.fromJson(Json json) {
    final domaine = json['domaine'];
    final sousDomaine = asJson(json['sous_domaine']);
    final isExternal = json['externalSource'] == 'HAL' || pickString(json, ['hal_id']) != null;
    return Ressource(
      id: pickString(json, ['id']) ?? '',
      titre: pickString(json, ['titre', 'title']) ?? 'Titre non disponible',
      sousTitre: pickString(json, ['sous_titre']),
      description: pickString(json, ['description']),
      auteurs: pickString(json, ['auteurs', 'auteur']),
      edition: pickString(json, ['edition']),
      lieuEdition: pickString(json, ['lieu_edition']),
      isbn: pickString(json, ['ISBN', 'isbn']),
      langue: pickString(json, ['langue']),
      pays: pickString(json, ['pays']),
      domaineId: domaine is Map ? pickString(Map<String, dynamic>.from(domaine), ['id']) : pickString(json, ['domaine_id']),
      domaineNom: domaine is Map
          ? pickString(Map<String, dynamic>.from(domaine), ['nom'])
          : (domaine is String ? domaine : null),
      sousDomaineNom: pickString(sousDomaine, ['nom']),
      type: pickString(json, ['type']),
      format: pickString(json, ['format']),
      datePublication: pickString(json, ['date_publication']),
      couverture: pickString(json, ['couverture']),
      fichiers: (json['fichiers'] is List ? json['fichiers'] as List : const [])
          .whereType<Map>()
          .map((f) => RessourceFichier.fromJson(Map<String, dynamic>.from(f)))
          .toList(),
      isExternal: isExternal,
      halId: pickString(json, ['hal_id']),
      keywords: (json['keywords'] is List ? json['keywords'] as List : const [])
          .map((e) => e.toString())
          .toList(),
      sourceUrl: pickString(json, ['source_url', 'detail_url']),
    );
  }

  final String id;
  final String titre;
  final String? sousTitre;
  final String? description;
  final String? auteurs;
  final String? edition;
  final String? lieuEdition;
  final String? isbn;
  final String? langue;
  final String? pays;
  final String? domaineId;
  final String? domaineNom;
  final String? sousDomaineNom;
  final String? type;
  final String? format;
  final String? datePublication;
  final String? couverture;
  final List<RessourceFichier> fichiers;
  final bool isExternal;
  final String? halId;
  final List<String> keywords;
  final String? sourceUrl;

  String? get coverUrl => AppConfig.mediaUrl(couverture);

  /// Identifiant utilisé pour les favoris et l'historique.
  String get key => isExternal ? 'HAL:${halId ?? id}' : id;
  String get externalId => halId ?? id;

  String get typeLabel => ResourceTypes.label(type);

  String get langueLabel {
    final value = (langue ?? '').toLowerCase();
    if (value == 'fr') return 'Français';
    if (value == 'en') return 'Anglais';
    return value.toUpperCase();
  }

  /// Représentation sérialisable (snapshot pour l'historique et les favoris HAL).
  Json toJson() => {
        'id': id,
        'titre': titre,
        'sous_titre': sousTitre,
        'description': description,
        'auteurs': auteurs,
        'edition': edition,
        'lieu_edition': lieuEdition,
        'ISBN': isbn,
        'langue': langue,
        'pays': pays,
        'domaine': {'id': domaineId, 'nom': domaineNom},
        if (sousDomaineNom != null) 'sous_domaine': {'nom': sousDomaineNom},
        'type': type,
        'format': format,
        'date_publication': datePublication,
        'couverture': couverture,
        'fichiers': fichiers.map((f) => f.toJson()).toList(),
        if (isExternal) 'externalSource': 'HAL',
        'hal_id': halId,
        'keywords': keywords,
        'source_url': sourceUrl,
      };

  /// Transforme un ouvrage HAL en ressource (miroir de `mapHalOuvrageToRessource`).
  static Ressource fromHal(Json ouvrage) {
    final documentUrl = halDocumentUrl(ouvrage);
    final title = pickString(ouvrage, ['title', 'titre']) ?? 'Titre non disponible';
    final authors = ouvrage['authors'] ?? ouvrage['auteurs'];
    final year = pickString(ouvrage, ['year', 'date_publication']);
    final domains = ouvrage['domains'] is List ? ouvrage['domains'] as List : const [];
    final domainNames = domains.map(halDomainName).where((e) => e.isNotEmpty).join(', ');
    final id = pickString(ouvrage, ['id', 'hal_id']) ?? '';
    return Ressource(
      id: id,
      titre: title,
      auteurs: authors is List ? authors.join(', ') : authors?.toString(),
      domaineNom: domainNames.isEmpty ? null : domainNames,
      type: pickString(ouvrage, ['doc_type', 'type']) ?? 'Publication',
      format: documentUrl != null ? 'pdf' : null,
      langue: pickString(ouvrage, ['language', 'langue']),
      datePublication: year,
      fichiers: documentUrl == null
          ? const []
          : [RessourceFichier(id: id, titre: title, path: documentUrl, format: 'pdf')],
      isExternal: true,
      halId: pickString(ouvrage, ['hal_id']) ?? id,
      keywords: (ouvrage['keywords'] is List ? ouvrage['keywords'] as List : const [])
          .map((e) => e.toString())
          .toList(),
      sourceUrl: pickString(ouvrage, ['source_url', 'detail_url']),
    );
  }

  static String? _httpUrl(String? candidate) {
    if (candidate == null) return null;
    final uri = Uri.tryParse(candidate);
    if (uri == null || !(uri.scheme == 'http' || uri.scheme == 'https')) return null;
    return candidate;
  }

  static String? halDocumentUrl(Json ouvrage) {
    final direct = _httpUrl(pickString(ouvrage, ['document_url']));
    if (direct != null) return direct;
    final files = ouvrage['files'] is List ? ouvrage['files'] as List : const [];
    for (final file in files) {
      if (file is Map && file['type'] == 'main') {
        final url = _httpUrl(file['url']?.toString());
        if (url != null) return url;
      }
    }
    final fichiers = ouvrage['fichiers'] is List ? ouvrage['fichiers'] as List : const [];
    for (final file in fichiers) {
      if (file is Map) {
        final url = _httpUrl(file['fichier']?.toString());
        if (url != null) return url;
      }
    }
    return null;
  }

  static String halDomainName(dynamic domain) {
    if (domain is String) return domain;
    if (domain is Map) {
      final name = domain['name']?.toString();
      if (name != null && name.isNotEmpty) return name;
      final label = domain['label']?.toString();
      if (label != null && label.isNotEmpty) {
        return label.split('/').where((e) => e.isNotEmpty).last;
      }
      return (domain['code'] ?? domain['id'] ?? '').toString();
    }
    return '';
  }
}

class Domaine {
  Domaine({required this.id, required this.nom, this.description});

  factory Domaine.fromJson(Json json) => Domaine(
        id: pickString(json, ['id']) ?? '',
        nom: pickString(json, ['nom', 'name']) ?? 'Domaine',
        description: pickString(json, ['description']),
      );

  final String id;
  final String nom;
  final String? description;
}
