import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import '../models/ressource.dart';

/// Favoris internes stockés côté serveur (`/favoris/`).
class FavorisService {
  FavorisService(this._client);

  final ApiClient _client;

  Future<List<Ressource>> list() async {
    try {
      final response = await _client.dio.get<dynamic>('/favoris/');
      return extractList(response.data).map((favori) {
        final ressource = asJson(favori['ressource']) ?? favori;
        final json = Map<String, dynamic>.from(ressource);
        json['id'] ??= favori['ressource_id'] ?? favori['id'];
        return Ressource.fromJson(json);
      }).toList();
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors du chargement des favoris');
    }
  }

  Future<void> add(String ressourceId) async {
    try {
      await _client.dio.post<dynamic>('/favoris/', data: {'ressource_id': int.tryParse(ressourceId) ?? ressourceId});
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        throw ApiException('Cette ressource est déjà dans vos favoris', statusCode: 409);
      }
      throw ApiException.from(e, fallback: "Erreur lors de l'ajout aux favoris");
    }
  }

  Future<void> remove(String ressourceId) async {
    try {
      await _client.dio.delete<dynamic>('/favoris/$ressourceId/');
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors de la suppression du favori');
    }
  }
}
