import '../../core/config.dart';
import '../../core/utils/json_utils.dart';

Json? _personSource(dynamic person) {
  final map = asJson(person);
  if (map == null) return null;
  return asJson(map['user']) ??
      asJson(map['utilisateur']) ??
      asJson(map['membre']) ??
      asJson(map['profil']) ??
      asJson(map['profile']) ??
      map;
}

/// Nom affichable d'une personne (membre, auteur…) quelle que soit la forme reçue.
String personName(dynamic person) {
  if (person is String && person.isNotEmpty) return person;
  final s = _personSource(person);
  if (s == null) return 'Utilisateur';
  final nom = pickString(s, ['nom', 'last_name', 'name']);
  final postnom = pickString(s, ['postnom', 'post_nom', 'middle_name']);
  final prenom = pickString(s, ['prenom', 'first_name']);
  if (nom != null && postnom != null) return '$nom $postnom';
  if (nom != null && prenom != null) return '$nom $prenom';
  return pickString(s, ['full_name']) ?? nom ?? prenom ?? pickString(s, ['username', 'email']) ?? 'Utilisateur';
}

String? personId(dynamic person) =>
    pickString(_personSource(person), ['id', 'user_id', 'pk', 'uuid', 'email', 'username']);

Json? personJson(dynamic person) => _personSource(person);

class SalonAttachment {
  SalonAttachment({required this.url, required this.name, required this.isImage, this.size});

  final String url;
  final String name;
  final bool isImage;
  final String? size;

  static final _imageExt = RegExp(r'\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$', caseSensitive: false);

  static SalonAttachment? from(dynamic raw) {
    if (raw == null) return null;
    final map = asJson(raw);
    final url = raw is String ? raw : pickString(map, ['url', 'file', 'fichier', 'path']);
    if (url == null || url.isEmpty) return null;
    final name = raw is String
        ? url.split('/').last
        : pickString(map, ['nom', 'name', 'filename', 'titre']) ?? url.split('/').last;
    final contentType = pickString(map, ['content_type', 'type']) ?? '';
    return SalonAttachment(
      url: AppConfig.mediaUrl(url)!,
      name: Uri.decodeComponent(name),
      isImage: contentType.startsWith('image/') || _imageExt.hasMatch(url),
      size: pickString(map, ['taille', 'size']),
    );
  }
}

/// Ressource partagée dans un salon (fichier, image ou lien).
class SalonResource {
  SalonResource({required this.title, required this.kind, this.url});

  factory SalonResource.fromJson(Json json) {
    final raw = pickString(json, ['url', 'lien', 'fichier', 'image', 'file']);
    final type = (pickString(json, ['type', 'type_ressource']) ??
            (json['image'] != null ? 'image' : json['lien'] != null ? 'lien' : 'fichier'))
        .toLowerCase();
    final url = AppConfig.mediaUrl(raw);
    return SalonResource(
      title: pickString(json, ['titre', 'nom', 'name']) ?? (raw != null ? Uri.decodeComponent(raw.split('/').last) : 'Ressource'),
      kind: type.contains('image') ? 'image' : type.contains('lien') ? 'lien' : 'fichier',
      url: url,
    );
  }

  final String title;
  final String kind; // fichier | image | lien
  final String? url;
}

class Salon {
  Salon({
    required this.id,
    required this.titre,
    required this.description,
    required this.membresCount,
    required this.messagesCount,
    required this.estMembre,
    required this.hasUnread,
    this.createur,
    this.ressources = const [],
  });

  factory Salon.fromJson(Json json) => Salon(
        id: pickString(json, ['id']) ?? '',
        titre: pickString(json, ['titre']) ?? 'Salon',
        description: pickString(json, ['description']) ?? '',
        membresCount: asInt(json['membres_count']),
        messagesCount: asInt(json['messages_count']) ?? 0,
        estMembre: asBool(json['est_membre']),
        hasUnread: asBool(json['has_unread']) ||
            asBool(json['a_non_lus']) ||
            asBool(json['non_lu']) ||
            asBool(json['unread']) ||
            (asInt(json['unread_count']) ?? 0) > 0 ||
            (asInt(json['non_lus_count']) ?? 0) > 0 ||
            (asInt(json['messages_non_lus_count']) ?? 0) > 0 ||
            (asInt(json['notifications_non_lues_count']) ?? 0) > 0,
        createur: personJson(json['createur']),
        ressources: extractList(json['ressources']).map(SalonResource.fromJson).toList(),
      );

  final String id;
  final String titre;
  final String description;
  final int? membresCount;
  final int messagesCount;
  final bool estMembre;
  final bool hasUnread;
  final Json? createur;
  final List<SalonResource> ressources;
}

enum MessageStatus { sent, delivered, read }

class SalonMessage {
  SalonMessage({
    required this.id,
    required this.contenu,
    required this.author,
    required this.date,
    required this.attachments,
    required this.status,
    this.isOwnFlag,
  });

  factory SalonMessage.fromJson(Json json) {
    final author = json['expediteur'] ?? json['auteur'] ?? json['createur'] ?? json['user'] ?? json['utilisateur'] ?? json['sender'];
    final rawDate = pickString(json, ['date_envoi', 'date_creation', 'created_at', 'timestamp', 'date']);
    final modern = json['pieces_jointes'] ?? json['fichiers'] ?? json['files'] ?? json['images'];
    final attachments = modern is List
        ? modern.map(SalonAttachment.from).whereType<SalonAttachment>().toList()
        : [
            SalonAttachment.from(json['image'] ??
                json['photo'] ??
                json['fichier'] ??
                json['file'] ??
                json['document'] ??
                json['piece_jointe'] ??
                json['attachment']),
          ].whereType<SalonAttachment>().toList();
    final read = asBool(json['lu']) || asBool(json['read']);
    final delivered = asBool(json['recu']) || asBool(json['delivered']);
    return SalonMessage(
      id: pickString(json, ['id']) ?? '${rawDate ?? ''}-${json['contenu']}',
      contenu: pickString(json, ['contenu']) ?? '',
      author: author,
      date: rawDate == null ? null : DateTime.tryParse(rawDate)?.toLocal(),
      attachments: attachments,
      status: read ? MessageStatus.read : delivered ? MessageStatus.delivered : MessageStatus.sent,
      isOwnFlag: json['est_expediteur'] is bool ? json['est_expediteur'] as bool : null,
    );
  }

  final String id;
  final String contenu;
  final dynamic author;
  final DateTime? date;
  final List<SalonAttachment> attachments;
  final MessageStatus status;
  final bool? isOwnFlag;

  String get authorName => personName(author);
  String? get authorId => personId(author);
}

class SalonNotification {
  SalonNotification({required this.id, required this.salonId, required this.message, this.date});

  factory SalonNotification.fromJson(Json json) {
    final message = asJson(json['message']);
    final salon = json['salon'];
    return SalonNotification(
      id: pickString(json, ['id']) ?? '',
      salonId: pickString(json, ['salon_id']) ??
          pickString(asJson(salon), ['id']) ??
          pickString(message, ['salon_id']) ??
          pickString(asJson(message?['salon']), ['id']) ??
          (salon is! Map ? salon?.toString() : null),
      message: pickString(json, ['contenu', 'texte', 'titre', 'message']) ??
          pickString(message, ['contenu']) ??
          'Nouveau message',
      date: DateTime.tryParse(pickString(json, ['date_creation', 'created_at', 'date']) ?? '')?.toLocal(),
    );
  }

  final String id;
  final String? salonId;
  final String message;
  final DateTime? date;
}
