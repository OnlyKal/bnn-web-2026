import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config.dart';
import '../utils/json_utils.dart';
import 'local_store.dart';

/// Persistance de la session : le jeton est conservé dans le stockage sécurisé
/// du système (Keychain / Keystore), le profil dans les préférences locales.
class SessionStorage {
  SessionStorage({FlutterSecureStorage? secure})
      : _secure = secure ?? const FlutterSecureStorage();

  static const _tokenKey = 'bnn.authToken';
  static const _userKey = 'bnn.userData';
  static const _loginTimeKey = 'bnn.loginTime';

  final FlutterSecureStorage _secure;

  String? _token;
  Json? _user;
  DateTime? _loginTime;

  String? get token => _token;
  Json? get user => _user;
  DateTime? get loginTime => _loginTime;
  bool get hasSession => _token != null && _token!.isNotEmpty && _user != null;

  bool get isExpired {
    final time = _loginTime;
    if (time == null) return true;
    return DateTime.now().difference(time) > AppConfig.sessionLifetime;
  }

  /// En-tête `Authorization` : le jeton est utilisé tel quel s'il est déjà
  /// préfixé (`Bearer ` / `Token `), sinon préfixé par `Bearer `.
  String? get authorizationHeader {
    final value = _token;
    if (value == null || value.isEmpty) return null;
    if (value.startsWith('Bearer ') || value.startsWith('Token ')) return value;
    return 'Bearer $value';
  }

  Future<void> load() async {
    try {
      _token = await _secure.read(key: _tokenKey);
    } catch (_) {
      _token = null;
    }
    final store = LocalStore.instance;
    _user = asJson(store.getJson(_userKey));
    final millis = store.getInt(_loginTimeKey);
    _loginTime = millis != null ? DateTime.fromMillisecondsSinceEpoch(millis) : null;
  }

  Future<void> save(String token, Json? user, {bool resetLoginTime = true}) async {
    _token = token;
    _user = user ?? _user;
    await _secure.write(key: _tokenKey, value: token);
    final store = LocalStore.instance;
    await store.setJson(_userKey, _user);
    if (resetLoginTime || _loginTime == null) {
      _loginTime = DateTime.now();
      await store.setInt(_loginTimeKey, _loginTime!.millisecondsSinceEpoch);
    }
  }

  Future<void> updateUser(Json user) async {
    _user = user;
    await LocalStore.instance.setJson(_userKey, user);
  }

  Future<void> updateToken(String token) async {
    _token = token;
    await _secure.write(key: _tokenKey, value: token);
  }

  Future<void> clear() async {
    _token = null;
    _user = null;
    _loginTime = null;
    try {
      await _secure.delete(key: _tokenKey);
    } catch (_) {}
    final store = LocalStore.instance;
    await store.remove(_userKey);
    await store.remove(_loginTimeKey);
  }
}
