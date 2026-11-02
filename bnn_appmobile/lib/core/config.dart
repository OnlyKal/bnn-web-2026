/// Configuration globale de l'application (miroir de `src/config.js` côté Web).
///
/// L'URL du serveur peut être surchargée à la compilation :
/// `flutter run --dart-define=API_SERVER_URL=http://10.0.2.2:8000`
class AppConfig {
  AppConfig._();

  static const String apiServerUrl = String.fromEnvironment(
    'API_SERVER_URL',
    defaultValue: 'https://admin.cgiibnn-esursi.cd',
  );

  static const String apiBaseUrl = '$apiServerUrl/api/bnn';
  static const String halApiUrl = '$apiServerUrl/api/hal';

  static const String classroomUrl = 'https://classroom.cgiibnn-esursi.cd/';
  static const String portailUrl = 'https://portail.cgiibnn-esursi.cd/';

  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration halTimeout = Duration(seconds: 15);

  /// Durée de validité d'une session côté client (identique au Web : 24 h).
  static const Duration sessionLifetime = Duration(hours: 24);

  /// Construit l'URL complète d'un média (couverture, avatar, fichier).
  static String? mediaUrl(String? path) {
    if (path == null || path.trim().isEmpty) return null;
    if (path.startsWith('http')) return path;
    return '$apiServerUrl${path.startsWith('/') ? '' : '/'}$path';
  }
}
