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

  bool get isImage => RegExp(r'\.(png|jpe?g|gif|webp|bmp|heic)$', caseSensitive: false).hasMatch(name);
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

class SalonsService {
  SalonsService(this._client);

  final ApiClient _client;
  static const maxResources = 5;

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

  Future<List<Salon>> list({String search = ''}) => _guard(() async {
        final response = await _dio.get<dynamic>(
          '/salons/',
          queryParameters: search.trim().isEmpty ? null : {'search': search.trim()},
        );
        return extractList(response.data).map(Salon.fromJson).toList();
      }, 'Erreur lors du chargement des salons');

  Future<Salon> get(String id) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/$id/');
        return Salon.fromJson(extractObject(response.data) ?? {});
      }, 'Erreur lors du chargement du salon');

  Future<Salon?> create({required String titre, required String description, required SalonResourcesInput resources}) =>
      _guard(() async {
        final form = FormData.fromMap({'titre': titre.trim(), 'description': description.trim()});
        await _appendResources(form, resources);
        final response = await _dio.post<dynamic>('/salons/', data: form);
        final json = extractObject(response.data);
        return json == null || json['id'] == null ? null : Salon.fromJson(json);
      }, 'Erreur lors de la création du salon');

  Future<void> update(String id, {required String titre, required String description}) => _guard(
        () => _dio.patch<dynamic>('/salons/$id/', data: {'titre': titre.trim(), 'description': description.trim()}),
        'Erreur lors de la modification du salon',
      );

  Future<void> delete(String id) =>
      _guard(() => _dio.delete<dynamic>('/salons/$id/'), 'Erreur lors de la suppression du salon');

  Future<void> addResources(String id, SalonResourcesInput resources) => _guard(() async {
        final form = FormData();
        await _appendResources(form, resources);
        await _dio.post<dynamic>('/salons/$id/ressources/', data: form);
      }, "Erreur lors de l'ajout des ressources");

  Future<void> join(String id) =>
      _guard(() => _dio.post<dynamic>('/salons/$id/join/'), "Erreur lors de l'adhésion au salon");

  Future<void> quit(String id) =>
      _guard(() => _dio.post<dynamic>('/salons/$id/quit/'), 'Erreur lors de la sortie du salon');

  Future<List<Json>> members(String id) => _guard(() async {
        final response = await _dio.get<dynamic>('/salons/$id/members/');
        return extractList(response.data);
      }, 'Erreur lors du chargement des membres');

  Future<List<SalonMessage>> messages(String id, {String? afterId}) => _guard(() async {
        final response = await _dio.get<dynamic>(
          '/salons/$id/messages/',
          queryParameters: afterId == null ? null : {'after_id': afterId},
        );
        return extractList(response.data).map(SalonMessage.fromJson).toList();
      }, 'Erreur lors du chargement des messages');

  Future<void> send(String id, {String text = '', List<PickedUpload> files = const []}) => _guard(() async {
        if (files.isEmpty) {
          await _dio.post<dynamic>('/salons/$id/messages/', data: {'contenu': text.trim()});
          return;
        }
        final form = FormData();
        if (text.trim().isNotEmpty) form.fields.add(MapEntry('contenu', text.trim()));
        for (final file in files) {
          form.files.add(MapEntry('pieces_jointes', await MultipartFile.fromFile(file.path, filename: file.name)));
        }
        await _dio.post<dynamic>('/salons/$id/messages/', data: form);
      }, "Erreur lors de l'envoi du message");

  Future<List<SalonNotification>> notifications({bool unreadOnly = true}) => _guard(() async {
        final response = await _dio.get<dynamic>(
          '/salons/notifications/',
          queryParameters: unreadOnly ? {'unread_only': 1} : null,
        );
        return extractList(response.data).map(SalonNotification.fromJson).toList();
      }, 'Erreur lors du chargement des notifications');

  Future<void> markAllRead() => _guard(
        () => _dio.post<dynamic>('/salons/notifications/mark-read/'),
        'Erreur lors du marquage des notifications',
      );

  Future<void> markRead(String notificationId) => _guard(
        () => _dio.post<dynamic>('/salons/notifications/$notificationId/mark-read/'),
        'Erreur lors du marquage de la notification',
      );
}
