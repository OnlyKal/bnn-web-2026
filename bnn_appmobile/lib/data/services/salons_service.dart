import 'dart:convert';

import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import '../models/salon.dart';

/// Fichier local sélectionné pour un envoi (pièce jointe ou ressource).
class PickedUpload {
  const PickedUpload({required this.path, required this.name, required this.size});

  final String path;
  final String name;
  final int size;

  bool get isImage => RegExp(r'\.(png|jpe?g|gif|webp)$', caseSensitive: false).hasMatch(name);
}

/// Règles de fichiers identiques à celles du serveur (menu/salons/validators.py).
class SalonFileRules {
  SalonFileRules._();

  static const maxSizeMb = 20;
  static const maxSize = maxSizeMb * 1024 * 1024;
  static const extensions = {
    'pdf', 'epub', 'txt', 'csv', 'rtf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', //
    'ppt', 'pptx', 'odp', 'zip', 'jpg', 'jpeg', 'png', 'gif', 'webp',
  };

  /// Message d'erreur si le fichier est refusé, `null` sinon.
  static String? check(PickedUpload file) {
    final dot = file.name.lastIndexOf('.');
    final ext = dot < 0 ? '' : file.name.substring(dot + 1).toLowerCase();
    if (!extensions.contains(ext)) return '« ${file.name} » : type de fichier non autorisé.';
    if (file.size > maxSize) return '« ${file.name} » dépasse $maxSizeMb Mo.';
    return null;
  }

  static bool isHttpUrl(String value) {
    final uri = Uri.tryParse(value.trim());
    return uri != null && (uri.scheme == 'http' || uri.scheme == 'https') && uri.host.isNotEmpty && value.length <= 1000;
  }
}

/// Contenu à ajouter à un salon (5 ressources maximum au total).
class SalonResourcesInput {
  const SalonResourcesInput({this.files = const [], this.links = const []});

  final List<PickedUpload> files;
  final List<String> links;

  int get count => files.length + links.length;

  static List<String> splitLinks(String value) =>
      value.split(RegExp(r'[\n,]')).map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
}

/// Liste des salons avec les compteurs globaux.
class SalonListPage {
  const SalonListPage({required this.salons, this.nouveaux = 0, this.nonLus = 0});

  final List<Salon> salons;
  final int nouveaux;
  final int nonLus;
}

/// Page de messages (les plus anciens en premier).
class SalonMessagePage {
  const SalonMessagePage({required this.messages, this.hasMore = false});

  final List<SalonMessage> messages;
  final bool hasMore;
}

class SalonNotificationPage {
  const SalonNotificationPage({required this.items, this.nonLues = 0});

  final List<SalonNotification> items;
  final int nonLues;
}

enum SalonFiltre { tous, mesSalons, publics, prives }

class SalonsService {
  SalonsService(this._client);

  final ApiClient _client;
  static const maxResources = 5;
  static const maxAttachments = 5;

  Dio get _dio => _client.dio;

  Future<T> _guard<T>(Future<T> Function() call, String fallback) async {
    try {
      return await call();
    } catch (e) {
      throw ApiException.from(e, fallback: fallback);
    }
  }

  Future<void> _appendResources(FormData form, SalonResourcesInput input) async {
    for (final file in input.files) {
      form.files.add(MapEntry(
        file.isImage ? 'images' : 'fichiers',
        await MultipartFile.fromFile(file.path, filename: file.name),
      ));
    }
    for (final link in input.links) {
      form.fields.add(MapEntry('liens', link));
    }
  }

  // ---------------------------------------------------------------- Salons

  Future<SalonListPage> list({String search = '', SalonFiltre filtre = SalonFiltre.tous}) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/', queryParameters: {
          if (search.trim().isNotEmpty) 'search': search.trim(),
          if (filtre != SalonFiltre.tous)
            'filtre': switch (filtre) {
              SalonFiltre.mesSalons => 'mes_salons',
              SalonFiltre.publics => 'publics',
              _ => 'prives',
            },
        });
        final body = asJson(response.data);
        return SalonListPage(
          salons: extractList(response.data).map(Salon.fromJson).toList(),
          nouveaux: asInt(body?['nouveaux_count']) ?? 0,
          nonLus: asInt(body?['non_lus_total']) ?? 0,
        );
      }, 'Erreur lors du chargement des salons');

  /// La liste a été consultée : remet à zéro le compteur de nouveaux salons.
  Future<void> markSeen() => _guard(() => _dio.post<dynamic>('/salons/vu/'), 'Erreur');

  Future<Salon> get(String id) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/$id/');
        return Salon.fromJson(extractObject(response.data) ?? {});
      }, 'Erreur lors du chargement du salon');

  Future<Salon?> create({
    required String titre,
    required String description,
    required SalonResourcesInput resources,
    bool prive = false,
  }) =>
      _guard(() async {
        final form = FormData.fromMap({
          'titre': titre.trim(),
          'description': description.trim(),
          'visibilite': prive ? 'prive' : 'public',
        });
        await _appendResources(form, resources);
        final response = await _dio.post<dynamic>('/salons/', data: form);
        final json = extractObject(response.data);
        return json == null || json['id'] == null ? null : Salon.fromJson(json);
      }, 'Erreur lors de la création du salon');

  Future<void> update(String id, {required String titre, required String description, bool? prive}) => _guard(
        () => _dio.patch<dynamic>('/salons/$id/', data: {
          'titre': titre.trim(),
          'description': description.trim(),
          if (prive != null) 'visibilite': prive ? 'prive' : 'public',
        }),
        'Erreur lors de la modification du salon',
      );

  Future<void> delete(String id) =>
      _guard(() => _dio.delete<dynamic>('/salons/$id/'), 'Erreur lors de la suppression du salon');

  Future<void> addResources(String id, SalonResourcesInput resources) => _guard(() async {
        final form = FormData();
        await _appendResources(form, resources);
        await _dio.post<dynamic>('/salons/$id/ressources/', data: form);
      }, "Erreur lors de l'ajout des ressources");

  Future<void> deleteResource(String id, String resourceId) => _guard(
        () => _dio.delete<dynamic>('/salons/$id/ressources/$resourceId/'),
        'Erreur lors du retrait de la ressource',
      );

  // ---------------------------------------------------------------- Adhésion

  /// Rejoint un salon public, accepte une invitation ou demande l'accès à un
  /// salon privé. Retourne le message du serveur.
  Future<String> join(String id) => _guard(() async {
        final response = await _dio.post<dynamic>('/salons/$id/join/');
        return pickString(asJson(response.data), ['message']) ?? 'Vous avez rejoint le salon.';
      }, "Erreur lors de l'adhésion au salon");

  /// Page Salons du site web : le lien d'invitation y mène, et l'app sait aussi le lire.
  static const String webSalonsUrl = 'https://bnn.minesursi.gouv.cd/salons';

  /// Lien d'invitation généré et signé par le serveur (créateur du salon uniquement).
  Future<String> invitationLink(String id) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/$id/lien-invitation/');
        final token = pickString(asJson(asJson(response.data)?['data']), ['token']);
        if (token == null || token.isEmpty) throw ApiException("Lien d'invitation indisponible");
        return '$webSalonsUrl?invitation=${Uri.encodeQueryComponent(token)}';
      }, "Erreur lors de la création du lien d'invitation");

  /// Extrait le jeton d'un lien d'invitation collé (ou le jeton seul).
  static String? invitationTokenFrom(String input) {
    final text = input.trim();
    if (text.isEmpty) return null;
    final uri = Uri.tryParse(text);
    final fromLink = uri?.queryParameters['invitation'];
    if (fromLink != null && fromLink.isNotEmpty) return fromLink;
    return text.contains('://') || text.contains(' ') ? null : text;
  }

  /// Rejoint le salon d'un lien d'invitation. Retourne (identifiant du salon, message).
  Future<(String, String)> joinByInvitation(String token) => _guard(() async {
        final response = await _dio.post<dynamic>('/salons/rejoindre/', data: {'token': token});
        final body = asJson(response.data);
        final salonId = asJson(body?['data'])?['salon_id']?.toString();
        if (salonId == null) throw ApiException("Ce lien d'invitation n'est pas valide");
        return (salonId, pickString(body, ['message']) ?? 'Vous avez rejoint le salon.');
      }, "Ce lien d'invitation n'est pas valide");

  Future<void> quit(String id) =>
      _guard(() => _dio.post<dynamic>('/salons/$id/quit/'), 'Erreur lors de la sortie du salon');

  Future<void> markRead(String id) =>
      _guard(() => _dio.post<dynamic>('/salons/$id/lu/'), 'Erreur lors du marquage du salon');

  Future<SalonMembers> members(String id) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/$id/members/');
        final body = asJson(response.data);
        List<SalonMember> parse(dynamic raw) =>
            (raw is List ? raw : const []).map(asJson).whereType<Json>().map(SalonMember.fromJson).toList();
        return SalonMembers(
          membres: extractList(response.data).map(SalonMember.fromJson).toList(),
          demandes: parse(body?['demandes']),
          invites: parse(body?['invites']),
        );
      }, 'Erreur lors du chargement des membres');

  /// [action] : retirer, accepter, refuser ou annuler-invitation.
  Future<void> memberAction(String id, String userId, String action) => _guard(
        () => _dio.post<dynamic>('/salons/$id/membres/$userId/$action/'),
        'Action impossible sur ce membre',
      );

  Future<String> invite(String id, List<String> userIds) => _guard(() async {
        final response = await _dio.post<dynamic>('/salons/$id/inviter/', data: {'utilisateurs': userIds});
        return pickString(asJson(response.data), ['message']) ?? 'Invitation envoyée';
      }, "Erreur lors de l'invitation");

  Future<List<SalonUser>> searchUsers(String query) => _guard(() async {
        if (query.trim().length < 2) return const <SalonUser>[];
        final response = await _dio.get<dynamic>('/salons/utilisateurs/', queryParameters: {'search': query.trim()});
        return extractList(response.data).map(SalonUser.fromJson).toList();
      }, 'Erreur lors de la recherche des utilisateurs');

  // ---------------------------------------------------------------- Messages

  /// Sans paramètre : les derniers messages (le salon est alors marqué lu).
  Future<SalonMessagePage> messages(
    String id, {
    String? afterId,
    String? beforeId,
    String? search,
    int limit = 50,
  }) =>
      _guard(() async {
        final response = await _dio.get<dynamic>('/salons/$id/messages/', queryParameters: {
          'limit': limit,
          'after_id': ?afterId,
          'before_id': ?beforeId,
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        });
        final body = asJson(response.data);
        return SalonMessagePage(
          messages: extractList(response.data).map(SalonMessage.fromJson).toList(),
          hasMore: asBool(body?['has_more']),
        );
      }, 'Erreur lors du chargement des messages');

  Future<SalonMessage?> send(
    String id, {
    String text = '',
    List<PickedUpload> files = const [],
    String? replyTo,
    SharedResource? resource,
  }) =>
      _guard(() async {
        final Object data;
        if (files.isEmpty) {
          data = {
            'contenu': text.trim(),
            'reponse_a': ?replyTo,
            if (resource != null) 'ressource_partagee': resource.toJson(),
          };
        } else {
          final form = FormData();
          if (text.trim().isNotEmpty) form.fields.add(MapEntry('contenu', text.trim()));
          if (replyTo != null) form.fields.add(MapEntry('reponse_a', replyTo));
          if (resource != null) form.fields.add(MapEntry('ressource_partagee', jsonEncode(resource.toJson())));
          for (final file in files) {
            form.files.add(MapEntry('pieces_jointes', await MultipartFile.fromFile(file.path, filename: file.name)));
          }
          data = form;
        }
        final response = await _dio.post<dynamic>('/salons/$id/messages/', data: data);
        final json = extractObject(response.data);
        return json == null || json['id'] == null ? null : SalonMessage.fromJson(json);
      }, "Erreur lors de l'envoi du message");

  Future<SalonMessage?> editMessage(String id, String messageId, String text) => _guard(() async {
        final response = await _dio.patch<dynamic>('/salons/$id/messages/$messageId/', data: {'contenu': text.trim()});
        final json = extractObject(response.data);
        return json == null || json['id'] == null ? null : SalonMessage.fromJson(json);
      }, 'Erreur lors de la modification du message');

  Future<void> deleteMessage(String id, String messageId) => _guard(
        () => _dio.delete<dynamic>('/salons/$id/messages/$messageId/'),
        'Erreur lors de la suppression du message',
      );

  Future<bool> pinMessage(String id, String messageId, {required bool pinned}) => _guard(() async {
        final response =
            await _dio.post<dynamic>('/salons/$id/messages/$messageId/epingler/', data: {'epingle': pinned});
        return asBool(extractObject(response.data)?['epingle']);
      }, "Erreur lors de l'épinglage");

  Future<String> reportMessage(String id, String messageId, String motif) => _guard(() async {
        final response = await _dio.post<dynamic>('/salons/$id/messages/$messageId/signaler/', data: {'motif': motif});
        return pickString(asJson(response.data), ['message']) ?? 'Message signalé';
      }, 'Erreur lors du signalement');

  Future<List<SalonReport>> reports(String id) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/$id/signalements/');
        return extractList(response.data).map(SalonReport.fromJson).toList();
      }, 'Erreur lors du chargement des signalements');

  Future<void> resolveReport(String id, String reportId) => _guard(
        () => _dio.post<dynamic>('/salons/$id/signalements/$reportId/traiter/'),
        'Erreur lors du traitement du signalement',
      );

  // ---------------------------------------------------------------- Notifications

  Future<SalonNotificationPage> notifications({bool unreadOnly = false, int limit = 30}) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/notifications/', queryParameters: {
          'limit': limit,
          if (unreadOnly) 'unread_only': 1,
        });
        return SalonNotificationPage(
          items: extractList(response.data).map(SalonNotification.fromJson).toList(),
          nonLues: asInt(asJson(response.data)?['non_lues_count']) ?? 0,
        );
      }, 'Erreur lors du chargement des notifications');

  /// Marque toutes les notifications comme lues (ou celles d'un salon).
  Future<void> markAllRead({String? salonId}) => _guard(
        () => _dio.post<dynamic>('/salons/notifications/mark-read/', data: {'salon_id': ?salonId}),
        'Erreur lors du marquage des notifications',
      );

  Future<void> markNotificationRead(String notificationId) => _guard(
        () => _dio.post<dynamic>('/salons/notifications/$notificationId/mark-read/'),
        'Erreur lors du marquage de la notification',
      );
}
