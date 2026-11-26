import '../../core/config.dart';
import '../../core/utils/json_utils.dart';

/// Modèles du module Salon (format de l'API salon-v2, voir menu/salons/ côté serveur).

Json? _personSource(dynamic person) {
  final map = asJson(person);
  if (map == null) return null;
  return asJson(map['utilisateur']) ?? asJson(map['user']) ?? map;
}

/// Nom affichable d'une personne (membre, auteur…).
String personName(dynamic person) {
  if (person is String && person.isNotEmpty) return person;
  final s = _personSource(person);
  if (s == null) return 'Utilisateur';
  final complet = pickString(s, ['nom_complet']);
  if (complet != null) return complet;
  final prenom = pickString(s, ['prenom']);
  final nom = pickString(s, ['nom']);
  if (prenom != null && nom != null) return '$prenom $nom';
  return nom ?? prenom ?? pickString(s, ['username']) ?? 'Utilisateur';
}

String? personId(dynamic person) => pickString(_personSource(person), ['id']);

Json? personJson(dynamic person) => _personSource(person);

/// Utilisateur tel que l'API des salons l'expose (sans e-mail ni matricule).
class SalonUser {
  const SalonUser({required this.id, required this.username, required this.name, this.avatarUrl});

  factory SalonUser.fromJson(Json? json) => SalonUser(
        id: pickString(json, ['id']) ?? '',
        username: pickString(json, ['username']) ?? '',
        name: personName(json),
        avatarUrl: pickString(json, ['avatar_url']),
      );

  final String id;
  final String username;
  final String name;
  final String? avatarUrl;

  String get initial => name.isEmpty ? '?' : String.fromCharCode(name.runes.first).toUpperCase();
}

class SalonAttachment {
  SalonAttachment({required this.url, required this.name, required this.isImage, this.size});

  final String url;
  final String name;
  final bool isImage;
  final int? size;

  static final _imageExt = RegExp(r'\.(png|jpe?g|gif|webp)(\?.*)?$', caseSensitive: false);

  static SalonAttachment? from(dynamic raw) {
    final map = asJson(raw);
    final url = raw is String ? raw : pickString(map, ['url']);
    if (url == null || url.isEmpty) return null;
    final name = pickString(map, ['nom']) ?? Uri.decodeComponent(url.split('/').where((p) => p.isNotEmpty).last);
    final contentType = pickString(map, ['content_type']) ?? '';
    return SalonAttachment(
      url: AppConfig.mediaUrl(url)!,
      name: name,
      isImage: contentType.startsWith('image/') || _imageExt.hasMatch(name),
      size: asInt(map?['taille']),
    );
  }
}

/// Ressource déposée dans un salon (fichier, image ou lien).
class SalonResource {
  SalonResource({required this.id, required this.title, required this.kind, this.url});

  factory SalonResource.fromJson(Json json) {
    final kind = (pickString(json, ['type']) ?? 'fichier').toLowerCase();
    final url = pickString(json, ['url', 'lien', 'fichier_url', 'image_url']);
    return SalonResource(
      id: pickString(json, ['id']) ?? '',
      title: pickString(json, ['titre']) ?? (url != null ? Uri.decodeComponent(url.split('/').last) : 'Ressource'),
      kind: kind.contains('image') ? 'image' : kind.contains('lien') ? 'lien' : 'fichier',
      url: AppConfig.mediaUrl(url),
    );
  }

  final String id;
  final String title;
  final String kind; // fichier | image | lien
  final String? url;
}

/// Statut de l'utilisateur courant dans un salon.
enum SalonStatut {
  aucun,
  membre,
  enAttente,
  invite,
  parti,
  retire,
  refuse;

  static SalonStatut parse(String? value) => switch (value) {
        'membre' => SalonStatut.membre,
        'en_attente' => SalonStatut.enAttente,
        'invite' => SalonStatut.invite,
        'parti' => SalonStatut.parti,
        'retire' => SalonStatut.retire,
        'refuse' => SalonStatut.refuse,
        _ => SalonStatut.aucun,
      };

  String get label => switch (this) {
        SalonStatut.membre => 'Membre',
        SalonStatut.enAttente => 'Demande envoyée',
        SalonStatut.invite => 'Invitation reçue',
        SalonStatut.parti => 'A quitté',
        SalonStatut.retire => 'Retiré',
        SalonStatut.refuse => 'Demande refusée',
        SalonStatut.aucun => 'À rejoindre',
      };
}

class Salon {
  Salon({
    required this.id,
    required this.titre,
    required this.description,
    required this.membresCount,
    required this.messagesCount,
    required this.estMembre,
    this.estCreateur = false,
    this.statut = SalonStatut.aucun,
    this.prive = false,
    this.nonLus = 0,
    this.estNouveau = false,
    this.demandes = 0,
    this.ferme = false,
    this.dateFermeture,
    this.createur,
    this.ressources = const [],
    this.epingles = const [],
  });

  factory Salon.fromJson(Json json) {
    final statut = SalonStatut.parse(pickString(json, ['statut_membre']));
    return Salon(
      id: pickString(json, ['id']) ?? '',
      titre: pickString(json, ['titre']) ?? 'Salon',
      description: pickString(json, ['description']) ?? '',
      membresCount: asInt(json['membres_count']),
      messagesCount: asInt(json['messages_count']) ?? 0,
      estMembre: asBool(json['est_membre']) || statut == SalonStatut.membre,
      estCreateur: asBool(json['est_createur']),
      statut: statut,
      prive: pickString(json, ['visibilite']) == 'prive',
      nonLus: asInt(json['non_lus_count']) ?? 0,
      estNouveau: asBool(json['est_nouveau']),
      demandes: asInt(json['demandes_count']) ?? 0,
      ferme: asBool(json['ferme']),
      dateFermeture: DateTime.tryParse(pickString(json, ['date_fermeture']) ?? '')?.toLocal(),
      createur: personJson(json['createur']),
      ressources: extractList(json['ressources']).map(SalonResource.fromJson).toList(),
      epingles: extractList(json['messages_epingles']).map(SalonMessage.fromJson).toList(),
    );
  }

  final String id;
  final String titre;
  final String description;
  final int? membresCount;
  final int messagesCount;
  final bool estMembre;
  final bool estCreateur;
  final SalonStatut statut;
  final bool prive;
  final int nonLus;
  final bool estNouveau;
  final int demandes;

  /// Salon fermé : lecture seule pour tout le monde.
  final bool ferme;
  final DateTime? dateFermeture;
  final Json? createur;
  final List<SalonResource> ressources;
  final List<SalonMessage> epingles;

  bool get hasUnread => nonLus > 0;

  Salon copyWith({int? nonLus, int? messagesCount}) => Salon(
        id: id,
        titre: titre,
        description: description,
        membresCount: membresCount,
        messagesCount: messagesCount ?? this.messagesCount,
        estMembre: estMembre,
        estCreateur: estCreateur,
        statut: statut,
        prive: prive,
        nonLus: nonLus ?? this.nonLus,
        estNouveau: estNouveau,
        demandes: demandes,
        ferme: ferme,
        dateFermeture: dateFermeture,
        createur: createur,
        ressources: ressources,
        epingles: epingles,
      );
}

/// Membre (ou demande / invitation) d'un salon.
class SalonMember {
  SalonMember({required this.user, required this.statut, required this.estCreateur});

  factory SalonMember.fromJson(Json json) => SalonMember(
        user: SalonUser.fromJson(asJson(json['utilisateur'])),
        statut: SalonStatut.parse(pickString(json, ['statut'])),
        estCreateur: asBool(json['est_createur']),
      );

  final SalonUser user;
  final SalonStatut statut;
  final bool estCreateur;
}

class SalonMembers {
  const SalonMembers({this.membres = const [], this.demandes = const [], this.invites = const []});

  final List<SalonMember> membres;
  final List<SalonMember> demandes;
  final List<SalonMember> invites;
}

/// Ressource de la BNN, de HAL ou d'OpenAlex partagée dans un message.
class SharedResource {
  const SharedResource({required this.source, required this.identifiant, required this.titre, this.url, this.auteurs});

  static SharedResource? fromJson(dynamic raw) {
    final json = asJson(raw);
    if (json == null) return null;
    final source = pickString(json, ['source']);
    final titre = pickString(json, ['titre']);
    if (source == null || titre == null) return null;
    return SharedResource(
      source: source,
      identifiant: pickString(json, ['identifiant']) ?? '',
      titre: titre,
      url: pickString(json, ['url']),
      auteurs: pickString(json, ['auteurs']),
    );
  }

  final String source; // bnn | hal | openalex
  final String identifiant;
  final String titre;
  final String? url;
  final String? auteurs;

  String get sourceLabel => switch (source) {
        'bnn' => 'BNN',
        'hal' => 'HAL',
        'openalex' => 'OpenAlex',
        _ => 'Ressource',
      };

  Json toJson() => {
        'source': source,
        'identifiant': identifiant,
        'titre': titre,
        if (url != null) 'url': url,
        if (auteurs != null) 'auteurs': auteurs,
      };
}

class SalonReplyRef {
  const SalonReplyRef({required this.id, required this.authorName, required this.excerpt, required this.deleted});

  static SalonReplyRef? fromJson(dynamic raw) {
    final json = asJson(raw);
    if (json == null) return null;
    return SalonReplyRef(
      id: pickString(json, ['id']) ?? '',
      authorName: personName(asJson(json['expediteur'])),
      excerpt: pickString(json, ['extrait']) ?? '',
      deleted: asBool(json['supprime']),
    );
  }

  final String id;
  final String authorName;
  final String excerpt;
  final bool deleted;
}

class SalonMessage {
  SalonMessage({
    required this.id,
    required this.salonId,
    required this.contenu,
    required this.author,
    required this.date,
    required this.attachments,
    this.isOwnFlag,
    this.modifie = false,
    this.supprime = false,
    this.epingle = false,
    this.reponseA,
    this.mentions = const [],
    this.ressource,
  });

  factory SalonMessage.fromJson(Json json) {
    final rawDate = pickString(json, ['date_envoi']);
    final attachments = [
      if (pickString(json, ['image_url']) != null)
        SalonAttachment.from({'url': json['image_url'], 'nom': 'Image', 'content_type': 'image/*'}),
      ...extractList(json['pieces_jointes']).map(SalonAttachment.from),
    ].whereType<SalonAttachment>().toList();
    return SalonMessage(
      id: pickString(json, ['id']) ?? '',
      salonId: pickString(json, ['salon']) ?? '',
      contenu: pickString(json, ['contenu']) ?? '',
      author: asJson(json['expediteur']),
      date: rawDate == null ? null : DateTime.tryParse(rawDate)?.toLocal(),
      attachments: attachments,
      isOwnFlag: json['est_expediteur'] is bool ? json['est_expediteur'] as bool : null,
      modifie: asBool(json['modifie']),
      supprime: asBool(json['supprime']),
      epingle: asBool(json['epingle']),
      reponseA: SalonReplyRef.fromJson(json['reponse_a']),
      mentions: extractList(json['mentions']).map((m) => pickString(m, ['username']) ?? '').where((u) => u.isNotEmpty).toList(),
      ressource: SharedResource.fromJson(json['ressource_partagee']),
    );
  }

  final String id;
  final String salonId;
  final String contenu;
  final Json? author;
  final DateTime? date;
  final List<SalonAttachment> attachments;
  final bool? isOwnFlag;
  final bool modifie;
  final bool supprime;
  final bool epingle;
  final SalonReplyRef? reponseA;
  final List<String> mentions;
  final SharedResource? ressource;

  String get authorName => personName(author);
  String? get authorId => personId(author);
  int get numericId => int.tryParse(id) ?? 0;
}

class SalonNotification {
  SalonNotification({
    required this.id,
    required this.salonId,
    required this.message,
    this.type = '',
    this.salonTitre,
    this.lu = false,
    this.date,
  });

  factory SalonNotification.fromJson(Json json) => SalonNotification(
        id: pickString(json, ['id']) ?? '',
        salonId: pickString(json, ['salon_id']) ?? pickString(asJson(json['salon']), ['id']),
        message: pickString(json, ['message']) ?? 'Notification',
        type: pickString(json, ['type']) ?? '',
        salonTitre: pickString(json, ['salon_titre']) ?? pickString(asJson(json['salon']), ['titre']),
        lu: asBool(json['lu']),
        date: DateTime.tryParse(pickString(json, ['date_creation']) ?? '')?.toLocal(),
      );

  final String id;
  final String? salonId;
  final String message;
  final String type;
  final String? salonTitre;
  final bool lu;
  final DateTime? date;

  SalonNotification markRead() => SalonNotification(
        id: id,
        salonId: salonId,
        message: message,
        type: type,
        salonTitre: salonTitre,
        lu: true,
        date: date,
      );
}

class SalonReport {
  SalonReport({
    required this.id,
    required this.messageId,
    required this.authorName,
    required this.reporterName,
    required this.excerpt,
    required this.motif,
    required this.messageDeleted,
  });

  factory SalonReport.fromJson(Json json) {
    final message = asJson(json['message']) ?? const {};
    return SalonReport(
      id: pickString(json, ['id']) ?? '',
      messageId: pickString(message, ['id']) ?? '',
      authorName: personName(asJson(message['expediteur'])),
      reporterName: personName(asJson(json['auteur'])),
      excerpt: pickString(message, ['extrait']) ?? '',
      motif: pickString(json, ['motif']) ?? '',
      messageDeleted: asBool(message['supprime']),
    );
  }

  final String id;
  final String messageId;
  final String authorName;
  final String reporterName;
  final String excerpt;
  final String motif;
  final bool messageDeleted;
}
