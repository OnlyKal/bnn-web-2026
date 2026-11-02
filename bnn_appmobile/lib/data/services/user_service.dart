import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import 'auth_service.dart';

class UserService {
  UserService(this._client);

  final ApiClient _client;

  Future<Json?> getProfile() async {
    try {
      final response = await _client.dio.get<dynamic>('/user/profile/');
      return AuthService.normalizeUser(response.data);
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors du chargement du profil');
    }
  }

  /// Retourne `(utilisateur mis à jour, message)`.
  Future<(Json?, String?)> updateProfile(Json data) async {
    try {
      final response = await _client.dio.put<dynamic>('/user/update/', data: data);
      final body = response.data;
      final map = body is Map ? Map<String, dynamic>.from(body) : <String, dynamic>{};
      return (asJson(map['data']), pickString(map, ['message']));
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors de la mise à jour du profil');
    }
  }

  Future<void> changePassword(String oldPassword, String newPassword) async {
    try {
      await _client.dio.put<dynamic>(
        '/user/password/',
        data: {'old_password': oldPassword, 'new_password': newPassword},
      );
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors du changement de mot de passe');
    }
  }

  /// [dataUrl] : image encodée en `data:image/...;base64,...` (format attendu par l'API).
  Future<String?> updateAvatar(String dataUrl) async {
    try {
      final response = await _client.dio.patch<dynamic>(
        '/user/avatar/',
        data: {'avatar': dataUrl},
      );
      final body = response.data;
      if (body is Map) {
        return pickString(Map<String, dynamic>.from(body), ['avatar']) ??
            pickString(asJson(body['data']), ['avatar']);
      }
      return null;
    } catch (e) {
      throw ApiException.from(e, fallback: "Erreur lors de la mise à jour de l'avatar");
    }
  }
}
