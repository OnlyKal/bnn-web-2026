import 'package:dio/dio.dart';

/// Erreur applicative avec un message lisible en français.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isNetwork => statusCode == null;
  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;

  static const _fieldLabels = {
    'username': "Nom d'utilisateur",
    'nom': 'Nom',
    'prenom': 'Prénom',
    'password': 'Mot de passe',
    'email': 'Email',
    'telephone': 'Téléphone',
    'sexe': 'Sexe',
    'date_naissance': 'Date de naissance',
    'faculte': 'Faculté',
    'universite': 'Université',
    'role': "Type d'utilisateur",
    'old_password': 'Ancien mot de passe',
    'new_password': 'Nouveau mot de passe',
  };

  static const _genericFields = {
    'detail',
    'message',
    'error',
    'errors',
    'non_field_errors',
  };

  static const _technicalFields = {'status', 'status_code', 'code', 'success'};

  /// Transforme une erreur Dio (ou autre) en [ApiException].
  static ApiException from(Object error, {String fallback = 'Une erreur est survenue'}) {
    if (error is ApiException) return error;
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return ApiException('Le serveur met trop de temps à répondre. Veuillez réessayer.');
        case DioExceptionType.connectionError:
          return ApiException('Erreur de réseau. Vérifiez votre connexion internet.');
        case DioExceptionType.cancel:
          return ApiException('Requête annulée.');
        default:
          break;
      }
      final status = error.response?.statusCode;
      final data = error.response?.data;
      final formatted = _format(data).trim();
      if (formatted.isNotEmpty && !_looksLikeHtml(formatted)) {
        return ApiException(formatted, statusCode: status);
      }
      if (status != null && status >= 500) {
        return ApiException('Erreur serveur. Veuillez réessayer plus tard.', statusCode: status);
      }
      return ApiException(fallback, statusCode: status);
    }
    return ApiException(fallback);
  }

  static bool _looksLikeHtml(String text) => text.trimLeft().startsWith('<');

  static String _format(dynamic value, [String field = '']) {
    if (value == null) return '';
    if (value is List) {
      return value.map((item) => _format(item, field)).where((s) => s.isNotEmpty).join('\n');
    }
    if (value is Map) {
      return value.entries
          .where((e) => !_technicalFields.contains(e.key))
          .map((e) => _format(e.value, e.key.toString()))
          .where((s) => s.isNotEmpty)
          .join('\n');
    }
    final message = _humanize(value.toString(), field);
    if (field.isEmpty || _genericFields.contains(field)) return message;
    return '${_fieldLabels[field] ?? field}: $message';
  }

  static String _humanize(String message, String field) {
    final lower = message.toLowerCase();
    final exists = lower.contains('utilisateur') && lower.contains('existe');
    if (field == 'email' && exists && lower.contains('email')) {
      return 'Cette adresse email est déjà utilisée. Veuillez utiliser une autre adresse ou vous connecter.';
    }
    if (field == 'username' && exists && lower.contains('username')) {
      return "Ce nom d'utilisateur est déjà utilisé. Veuillez en choisir un autre.";
    }
    return message;
  }
}
