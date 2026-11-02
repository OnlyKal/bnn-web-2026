import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';

class LoginResult {
  LoginResult({required this.token, required this.user, this.message});

  final String token;
  final Json? user;
  final String? message;
}

class RegistrationData {
  RegistrationData({
    required this.username,
    required this.nom,
    required this.prenom,
    required this.password,
    required this.role,
    required this.sexe,
    required this.telephone,
    required this.email,
    required this.faculte,
    required this.universite,
    required this.dateNaissance,
  });

  final String username;
  final String nom;
  final String prenom;
  final String password;
  final String role;
  final String sexe;
  final String telephone;
  final String email;
  final String faculte;
  final String universite;
  final DateTime dateNaissance;

  Json toJson() => {
        'username': username.trim(),
        'nom': nom.trim(),
        'prenom': prenom.trim(),
        'password': password,
        'role': role,
        'sexe': sexe,
        'telephone': telephone.trim(),
        'email': email.trim(),
        'faculte': faculte.trim(),
        'universite': universite,
        // Même format que le Web : minuit heure de Kinshasa (+01:00) en ISO UTC.
        'date_naissance': DateTime.utc(
          dateNaissance.year,
          dateNaissance.month,
          dateNaissance.day,
        ).subtract(const Duration(hours: 1)).toIso8601String(),
      };
}

class AuthService {
  AuthService(this._client);

  final ApiClient _client;

  static Json? normalizeUser(dynamic payload) {
    if (payload is! Map) return null;
    final map = Map<String, dynamic>.from(payload);
    return asJson(map['data']) ?? asJson(map['user']) ?? asJson(map['profile']) ?? map;
  }

  Future<LoginResult> login(String username, String password) async {
    try {
      final response = await _client.unauthenticated.post<dynamic>(
        '/user/signin/',
        data: {'username': username.trim(), 'password': password},
      );
      final data = response.data;
      final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      final token = (map['token'] ?? asJson(map['data'])?['token'] ?? map['access'])?.toString();
      if (token == null || token.isEmpty) {
        throw ApiException(
          pickString(map, ['message']) ?? "Nom d'utilisateur ou mot de passe incorrect.",
        );
      }
      return LoginResult(
        token: token,
        user: normalizeUser(map),
        message: pickString(map, ['message']),
      );
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 400 || status == 401) {
        throw ApiException("Nom d'utilisateur ou mot de passe incorrect.", statusCode: status);
      }
      throw ApiException.from(e, fallback: 'Erreur de connexion');
    }
  }

  /// Retourne la réponse brute : elle peut contenir un jeton (connexion directe).
  Future<Json> register(RegistrationData data) async {
    try {
      final response = await _client.unauthenticated.post<dynamic>(
        '/user/signup/',
        data: data.toJson(),
      );
      return extractObject(response.data) ?? <String, dynamic>{};
    } catch (e) {
      throw ApiException.from(
        e,
        fallback: "Erreur lors de l'inscription. Veuillez réessayer.",
      );
    }
  }

  Future<String> resetPassword(String email) async {
    try {
      final response = await _client.unauthenticated.put<dynamic>(
        '/user/password-reset/',
        data: {'email': email.trim()},
      );
      final data = response.data;
      return (data is Map ? pickString(Map<String, dynamic>.from(data), ['message']) : null) ??
          'Mot de passe réinitialisé et envoyé par mail avec succès';
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 404) {
        throw ApiException('Service de réinitialisation de mot de passe non disponible.', statusCode: 404);
      }
      throw ApiException.from(e, fallback: 'Erreur lors de la réinitialisation du mot de passe');
    }
  }

  Future<void> logout() async {
    try {
      await _client.dio.post<dynamic>('/auth/logout/');
    } catch (_) {
      // Déconnexion locale même si le serveur ne répond pas.
    }
  }
}
