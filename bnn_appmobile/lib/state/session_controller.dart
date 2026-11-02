import 'package:flutter/foundation.dart';

import '../core/network/api_exception.dart';
import '../core/storage/session_storage.dart';
import '../core/utils/json_utils.dart';
import '../data/models/app_user.dart';
import '../data/services/auth_service.dart';
import '../data/services/user_service.dart';

enum SessionStatus { unknown, authenticated, unauthenticated }

/// État d'authentification de l'application.
class SessionController extends ChangeNotifier {
  SessionController({
    required SessionStorage storage,
    required AuthService authService,
    required UserService userService,
  })  : _storage = storage,
        _auth = authService,
        _users = userService;

  final SessionStorage _storage;
  final AuthService _auth;
  final UserService _users;

  SessionStatus _status = SessionStatus.unknown;
  AppUser? _user;
  String? _expiredMessage;

  SessionStatus get status => _status;
  AppUser? get user => _user;
  bool get isAuthenticated => _status == SessionStatus.authenticated;

  /// Message à afficher sur l'écran de connexion après une expiration.
  String? consumeExpiredMessage() {
    final message = _expiredMessage;
    _expiredMessage = null;
    return message;
  }

  Future<void> restore() async {
    await _storage.load();
    if (_storage.hasSession && !_storage.isExpired) {
      _user = AppUser(_storage.user!);
      _status = SessionStatus.authenticated;
      notifyListeners();
      refreshProfile();
    } else {
      if (_storage.hasSession) await _storage.clear();
      _status = SessionStatus.unauthenticated;
      notifyListeners();
    }
  }

  Future<String?> login(String username, String password) async {
    final result = await _auth.login(username, password);
    await _storage.save(result.token, result.user ?? <String, dynamic>{});
    _user = AppUser(_storage.user ?? <String, dynamic>{});
    await refreshProfile(notify: false);
    _status = SessionStatus.authenticated;
    notifyListeners();
    return result.message;
  }

  /// Après une inscription renvoyant directement un jeton.
  Future<void> startSession(String token, Json? user) async {
    await _storage.save(token, user ?? <String, dynamic>{});
    _user = AppUser(_storage.user ?? <String, dynamic>{});
    await refreshProfile(notify: false);
    _status = SessionStatus.authenticated;
    notifyListeners();
  }

  Future<void> refreshProfile({bool notify = true}) async {
    try {
      final fresh = await _users.getProfile();
      if (fresh != null && _storage.token != null) {
        await _storage.updateUser(fresh);
        _user = AppUser(fresh);
        if (notify) notifyListeners();
      }
    } on ApiException {
      // Le profil en cache reste utilisable hors ligne.
    }
  }

  Future<void> updateUser(Json user) async {
    await _storage.updateUser(user);
    _user = AppUser(user);
    notifyListeners();
  }

  Future<void> logout() async {
    await _auth.logout();
    await _endSession();
  }

  /// Appelé par le client HTTP lorsque le jeton ne peut plus être renouvelé.
  void handleSessionExpired() {
    if (_status != SessionStatus.authenticated) return;
    _expiredMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
    _endSession();
  }

  Future<void> _endSession() async {
    await _storage.clear();
    _user = null;
    _status = SessionStatus.unauthenticated;
    notifyListeners();
  }
}
