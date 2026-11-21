import 'package:flutter/material.dart';

import '../../core/config.dart';
import '../../core/utils/json_utils.dart';

/// Modèles de l'encyclopédie RDC (miroir de l'API /api/bnn/rdc/).

Color parseHexColor(String? hex, {Color fallback = const Color(0xFF1E42AC)}) {
  final value = hex?.replaceFirst('#', '');
  if (value == null || value.length != 6) return fallback;
  final parsed = int.tryParse(value, radix: 16);
  return parsed == null ? fallback : Color(0xFF000000 | parsed);
}

double? _asDouble(dynamic value) => value is num ? value.toDouble() : double.tryParse('${value ?? ''}');

List<T> _list<T>(dynamic raw, T Function(Json) build) =>
    raw is List ? raw.map(asJson).whereType<Json>().map(build).toList() : <T>[];

class RdcCategorie {
  RdcCategorie({
    required this.id,
    required this.nom,
    required this.slug,
    required this.icone,
    required this.couleur,
    this.description = '',
    this.image,
    this.nbFiches,
    this.afficherCarte = false,
    this.afficherChronologie = false,
    this.enfants = const [],
  });

  final int id;
  final String nom;
  final String slug;
  final String icone;
  final Color couleur;
  final String description;
  final String? image;
  final int? nbFiches;
  final bool afficherCarte;
  final bool afficherChronologie;
  final List<RdcCategorie> enfants;

  factory RdcCategorie.fromJson(Json json) => RdcCategorie(
        id: asInt(json['id']) ?? 0,
        nom: json['nom']?.toString() ?? '',
        slug: json['slug']?.toString() ?? '',
        icone: json['icone']?.toString() ?? 'document',
        couleur: parseHexColor(json['couleur']?.toString()),
        description: json['description']?.toString() ?? '',
        image: AppConfig.mediaUrl(json['image']?.toString()),
        nbFiches: asInt(json['nb_fiches']),
        afficherCarte: asBool(json['afficher_carte']),
        afficherChronologie: asBool(json['afficher_chronologie']),
        enfants: _list(json['enfants'], RdcCategorie.fromJson),
      );
}

/// Détail d'une rubrique : la catégorie, son fil d'Ariane et sa rubrique racine.
class RdcCategorieDetail {
  RdcCategorieDetail({required this.categorie, required this.filAriane, required this.racine});

  final RdcCategorie categorie;
  final List<RdcCategorie> filAriane;
  final RdcCategorie racine;

  bool get carte => categorie.afficherCarte || racine.afficherCarte;
  bool get chronologie => categorie.afficherChronologie || racine.afficherChronologie;

  factory RdcCategorieDetail.fromJson(Json json) => RdcCategorieDetail(
        categorie: RdcCategorie.fromJson(json),
        filAriane: _list(json['fil_ariane'], RdcCategorie.fromJson),
        racine: RdcCategorie.fromJson(asJson(json['racine']) ?? json),
      );
}

class RdcProvinceRef {
  RdcProvinceRef({required this.nom, required this.slug});

  final String nom;
  final String slug;

  factory RdcProvinceRef.fromJson(Json json) =>
      RdcProvinceRef(nom: json['nom']?.toString() ?? '', slug: json['slug']?.toString() ?? '');
}

class RdcMedia {
  RdcMedia({
    required this.id,
    required this.type,
    required this.typeLabel,
    this.titre = '',
    this.legende = '',
    this.url,
    this.vignette,
    this.credit = '',
  });

  final int id;
  final String type;
  final String typeLabel;
  final String titre;
  final String legende;
  final String? url;
  final String? vignette;
  final String credit;

  bool get isVisual => const {'image', 'carte', 'infographie'}.contains(type);

  factory RdcMedia.fromJson(Json json) => RdcMedia(
        id: asInt(json['id']) ?? 0,
        type: json['type']?.toString() ?? 'image',
        typeLabel: json['type_label']?.toString() ?? '',
        titre: json['titre']?.toString() ?? '',
        legende: json['legende']?.toString() ?? '',
        url: AppConfig.mediaUrl(json['url']?.toString()),
        vignette: AppConfig.mediaUrl(json['vignette']?.toString()),
        credit: json['credit']?.toString() ?? '',
      );
}

class RdcSource {
  RdcSource({required this.typeLabel, required this.titre, this.auteurs = '', this.editeur = '', this.annee = '', this.url = '', this.note = ''});

  final String typeLabel;
  final String titre;
  final String auteurs;
  final String editeur;
  final String annee;
  final String url;
  final String note;

  String get citation =>
      [auteurs, titre.isEmpty ? '' : '« $titre »', editeur, annee, note].where((e) => e.isNotEmpty).join(', ');

  factory RdcSource.fromJson(Json json) => RdcSource(
        typeLabel: json['type_label']?.toString() ?? '',
        titre: json['titre']?.toString() ?? '',
        auteurs: json['auteurs']?.toString() ?? '',
        editeur: json['editeur']?.toString() ?? '',
        annee: json['annee']?.toString() ?? '',
        url: json['url']?.toString() ?? '',
        note: json['note']?.toString() ?? '',
      );
}

class RdcDonnee {
  RdcDonnee({required this.libelle, required this.valeur, this.unite = '', this.annee = ''});

  final String libelle;
  final String valeur;
  final String unite;
  final String annee;

  String get texte => [valeur, unite].where((e) => e.isNotEmpty).join(' ') + (annee.isEmpty ? '' : ' ($annee)');

  factory RdcDonnee.fromJson(Json json) => RdcDonnee(
        libelle: json['libelle']?.toString() ?? '',
        valeur: json['valeur']?.toString() ?? '',
        unite: json['unite']?.toString() ?? '',
        annee: json['annee']?.toString() ?? '',
      );
}

class RdcPeriode {
  RdcPeriode({
    required this.nom,
    required this.slug,
    required this.couleur,
    required this.libelleDates,
    this.anneeDebut,
    this.anneeFin,
    this.resume = '',
    this.nbFiches,
  });

  final String nom;
  final String slug;
  final Color couleur;
  final String libelleDates;
  final int? anneeDebut;
  final int? anneeFin;
  final String resume;
  final int? nbFiches;

  bool contains(int year) => (anneeDebut == null || year >= anneeDebut!) && (anneeFin == null || year < anneeFin!);

  factory RdcPeriode.fromJson(Json json) => RdcPeriode(
        nom: json['nom']?.toString() ?? '',
        slug: json['slug']?.toString() ?? '',
        couleur: parseHexColor(json['couleur']?.toString()),
        libelleDates: json['libelle_dates']?.toString() ?? '',
        anneeDebut: asInt(json['annee_debut']),
        anneeFin: asInt(json['annee_fin']),
        resume: json['resume']?.toString() ?? '',
        nbFiches: asInt(json['nb_fiches']),
      );
}

class RdcFiche {
  RdcFiche({
    required this.id,
    required this.titre,
    required this.slug,
    required this.resume,
    required this.categorie,
    required this.nature,
    required this.natureLabel,
    this.image,
    this.provinces = const [],
    this.anneeDebut,
    this.libelleDates = '',
    this.periodeSlug,
    this.latitude,
    this.longitude,
  });

  final int id;
  final String titre;
  final String slug;
  final String resume;
  final RdcCategorie categorie;
  final String nature;
  final String natureLabel;
  final String? image;
  final List<RdcProvinceRef> provinces;
  final int? anneeDebut;
  final String libelleDates;
  final String? periodeSlug;
  final double? latitude;
  final double? longitude;

  factory RdcFiche.fromJson(Json json) => RdcFiche(
        id: asInt(json['id']) ?? 0,
        titre: json['titre']?.toString() ?? '',
        slug: json['slug']?.toString() ?? '',
        resume: json['resume']?.toString() ?? '',
        categorie: RdcCategorie.fromJson(asJson(json['categorie']) ?? const {}),
        nature: json['nature']?.toString() ?? '',
        natureLabel: json['nature_label']?.toString() ?? '',
        image: AppConfig.mediaUrl(json['image']?.toString()),
        provinces: _list(json['provinces'], RdcProvinceRef.fromJson),
        anneeDebut: asInt(json['annee_debut']),
        libelleDates: json['libelle_dates']?.toString() ?? '',
        periodeSlug: json['periode_slug']?.toString(),
        latitude: _asDouble(json['latitude']),
        longitude: _asDouble(json['longitude']),
      );
}

class RdcFicheDetail {
  RdcFicheDetail({
    required this.fiche,
    required this.contenu,
    required this.imagePrincipale,
    required this.creditImage,
    required this.filAriane,
    required this.lieu,
    required this.localites,
    required this.geometrie,
    required this.periode,
    required this.motsCles,
    required this.medias,
    required this.sources,
    required this.donnees,
    required this.fichesLiees,
    required this.dateMiseAJour,
    required this.vues,
    this.online = false,
  });

  final bool online;

  final RdcFiche fiche;
  final String contenu;
  final String? imagePrincipale;
  final String creditImage;
  final List<RdcCategorie> filAriane;
  final String lieu;
  final List<String> localites;
  final Json? geometrie;
  final RdcPeriode? periode;
  final List<String> motsCles;
  final List<RdcMedia> medias;
  final List<RdcSource> sources;
  final List<RdcDonnee> donnees;
  final List<RdcFiche> fichesLiees;
  final DateTime? dateMiseAJour;
  final int vues;

  factory RdcFicheDetail.fromJson(Json json) => RdcFicheDetail(
        fiche: RdcFiche.fromJson(json),
        contenu: json['contenu']?.toString() ?? '',
        imagePrincipale: AppConfig.mediaUrl(json['image_principale']?.toString()),
        creditImage: json['credit_image']?.toString() ?? '',
        filAriane: _list(json['fil_ariane'], RdcCategorie.fromJson),
        lieu: json['lieu']?.toString() ?? '',
        localites: _list(json['localites'], (l) => '${l['nom']} (${l['type_label']})'),
        geometrie: asJson(json['geometrie']),
        periode: asJson(json['periode']) == null ? null : RdcPeriode.fromJson(asJson(json['periode'])!),
        motsCles: (json['mots_cles'] is List) ? (json['mots_cles'] as List).map((e) => '$e').toList() : const [],
        medias: _list(json['medias'], RdcMedia.fromJson),
        sources: _list(json['sources'], RdcSource.fromJson),
        donnees: _list(json['donnees'], RdcDonnee.fromJson),
        fichesLiees: _list(json['fiches_liees'], RdcFiche.fromJson),
        dateMiseAJour: DateTime.tryParse(json['date_mise_a_jour']?.toString() ?? ''),
        vues: asInt(json['vues']) ?? 0,
        online: json['source'] == 'wikimedia',
      );
}

class RdcLocalite {
  RdcLocalite({required this.nom, required this.typeLabel, this.chefLieu = '', this.population, this.latitude, this.longitude});

  final String nom;
  final String typeLabel;
  final String chefLieu;
  final int? population;
  final double? latitude;
  final double? longitude;

  factory RdcLocalite.fromJson(Json json) => RdcLocalite(
        nom: json['nom']?.toString() ?? '',
        typeLabel: json['type_label']?.toString() ?? '',
        chefLieu: json['chef_lieu']?.toString() ?? '',
        population: asInt(json['population']),
        latitude: _asDouble(json['latitude']),
        longitude: _asDouble(json['longitude']),
      );
}

class RdcProvince {
  RdcProvince({
    required this.nom,
    required this.slug,
    this.code = '',
    this.chefLieu = '',
    this.presentation = '',
    this.superficie,
    this.population,
    this.anneePopulation,
    this.latitude,
    this.longitude,
    this.zoom = 7,
    this.image,
    this.nbFiches = 0,
  });

  final String nom;
  final String slug;
  final String code;
  final String chefLieu;
  final String presentation;
  final int? superficie;
  final int? population;
  final int? anneePopulation;
  final double? latitude;
  final double? longitude;
  final int zoom;
  final String? image;
  final int nbFiches;

  factory RdcProvince.fromJson(Json json) => RdcProvince(
        nom: json['nom']?.toString() ?? '',
        slug: json['slug']?.toString() ?? '',
        code: json['code']?.toString() ?? '',
        chefLieu: json['chef_lieu']?.toString() ?? '',
        presentation: json['presentation']?.toString() ?? '',
        superficie: asInt(json['superficie_km2']),
        population: asInt(json['population']),
        anneePopulation: asInt(json['annee_population']),
        latitude: _asDouble(json['latitude']),
        longitude: _asDouble(json['longitude']),
        zoom: asInt(json['zoom']) ?? 7,
        image: AppConfig.mediaUrl(json['image']?.toString()),
        nbFiches: asInt(json['nb_fiches']) ?? 0,
      );
}

class RdcRubriqueProvince {
  RdcRubriqueProvince({required this.categorie, required this.total, required this.fiches});

  final RdcCategorie categorie;
  final int total;
  final List<RdcFiche> fiches;
}

class RdcProvinceDetail {
  RdcProvinceDetail({
    required this.province,
    required this.description,
    required this.langues,
    required this.sections,
    required this.contour,
    required this.imagePrincipale,
    required this.localites,
    required this.medias,
    required this.sources,
    required this.donnees,
    required this.rubriques,
  });

  final RdcProvince province;
  final String description;
  final String langues;

  /// Libellé → texte (climat, relief, végétation…), uniquement les champs renseignés.
  final List<MapEntry<String, String>> sections;
  final Json? contour;
  final String? imagePrincipale;
  final List<RdcLocalite> localites;
  final List<RdcMedia> medias;
  final List<RdcSource> sources;
  final List<RdcDonnee> donnees;
  final List<RdcRubriqueProvince> rubriques;

  static const _sections = {
    'climat': 'Climat',
    'relief': 'Relief',
    'vegetation': 'Végétation',
    'hydrographie': 'Hydrographie',
    'economie': 'Principales activités économiques',
    'culture': 'Particularités culturelles et linguistiques',
  };

  factory RdcProvinceDetail.fromJson(Json json) => RdcProvinceDetail(
        province: RdcProvince.fromJson(json),
        description: json['description']?.toString() ?? '',
        langues: json['langues']?.toString() ?? '',
        sections: [
          for (final entry in _sections.entries)
            if ((json[entry.key]?.toString() ?? '').trim().isNotEmpty) MapEntry(entry.value, json[entry.key].toString()),
        ],
        contour: asJson(json['contour']),
        imagePrincipale: AppConfig.mediaUrl(json['image_principale']?.toString()),
        localites: _list(json['localites'], RdcLocalite.fromJson),
        medias: _list(json['medias'], RdcMedia.fromJson),
        sources: _list(json['sources'], RdcSource.fromJson),
        donnees: _list(json['donnees'], RdcDonnee.fromJson),
        rubriques: _list(
          json['rubriques'],
          (r) => RdcRubriqueProvince(
            categorie: RdcCategorie.fromJson(asJson(r['categorie']) ?? const {}),
            total: asInt(r['total']) ?? 0,
            fiches: _list(r['fiches'], RdcFiche.fromJson),
          ),
        ),
      );
}

/// Objet de la carte (point, tracé ou zone), issu d'une entité GeoJSON.
class RdcMapFeature {
  RdcMapFeature({
    required this.id,
    required this.kind,
    required this.titre,
    required this.couleur,
    required this.geometry,
    this.slug,
    this.resume = '',
    this.categorie = '',
    this.rubriqueSlug,
    this.image,
    this.libelleDates = '',
    this.anchor,
  });

  final String id;

  /// `fiche`, `province` ou `localite`.
  final String kind;
  final String titre;
  final Color couleur;
  final Json geometry;
  final String? slug;
  final String resume;
  final String categorie;
  final String? rubriqueSlug;
  final String? image;
  final String libelleDates;

  /// [lng, lat] explicite pour un tracé (sinon calculé).
  final List<double>? anchor;

  factory RdcMapFeature.fromJson(Json json) {
    final p = asJson(json['properties']) ?? const {};
    final point = p['point'];
    return RdcMapFeature(
      id: json['id']?.toString() ?? '',
      kind: p['type_objet']?.toString() ?? 'fiche',
      titre: p['titre']?.toString() ?? '',
      couleur: parseHexColor(p['couleur']?.toString()),
      geometry: asJson(json['geometry']) ?? const {},
      slug: p['slug']?.toString(),
      resume: p['resume']?.toString() ?? '',
      categorie: p['categorie']?.toString() ?? '',
      rubriqueSlug: p['rubrique_slug']?.toString(),
      image: AppConfig.mediaUrl(p['image']?.toString()),
      libelleDates: p['libelle_dates']?.toString() ?? '',
      anchor: point is List && point.length == 2 ? [_asDouble(point[0])!, _asDouble(point[1])!] : null,
    );
  }
}

class RdcPage<T> {
  RdcPage({required this.items, required this.count, required this.page, required this.totalPages});

  final List<T> items;
  final int count;
  final int page;
  final int totalPages;

  bool get hasNext => page < totalPages;
}

class RdcAccueil {
  RdcAccueil({
    required this.categories,
    required this.vedette,
    required this.recentes,
    required this.periodes,
    required this.stats,
    this.online = false,
  });

  /// Contenus issus de Wikipédia / Wikidata (et non de l'API BNN).
  final bool online;
  final List<RdcCategorie> categories;
  final List<RdcFiche> vedette;
  final List<RdcFiche> recentes;
  final List<RdcPeriode> periodes;
  final Map<String, int> stats;

  factory RdcAccueil.fromJson(Json json) => RdcAccueil(
        categories: _list(json['categories'], RdcCategorie.fromJson),
        vedette: _list(json['vedette'], RdcFiche.fromJson),
        recentes: _list(json['recentes'], RdcFiche.fromJson),
        periodes: _list(json['periodes'], RdcPeriode.fromJson),
        stats: {
          for (final e in (asJson(json['statistiques']) ?? const {}).entries)
            if (asInt(e.value) != null) e.key: asInt(e.value)!,
        },
        online: json['source'] == 'wikimedia',
      );
}

class RdcFiltres {
  RdcFiltres({required this.categories, required this.provinces, required this.natures, required this.periodes});

  final List<RdcCategorie> categories;
  final List<RdcProvinceRef> provinces;
  final List<MapEntry<String, String>> natures;
  final List<RdcPeriode> periodes;

  factory RdcFiltres.fromJson(Json json) => RdcFiltres(
        categories: _list(json['categories'], RdcCategorie.fromJson),
        provinces: _list(json['provinces'], RdcProvinceRef.fromJson),
        natures: _list(json['natures'], (n) => MapEntry(n['valeur'].toString(), n['label'].toString())),
        periodes: _list(json['periodes'], RdcPeriode.fromJson),
      );
}
