import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Accès centralisé aux préférences locales (équivalent du `localStorage` Web).
class LocalStore {
  LocalStore._(this._prefs);

  static LocalStore? _instance;
  final SharedPreferences _prefs;

  static Future<LocalStore> init() async {
    _instance ??= LocalStore._(await SharedPreferences.getInstance());
    return _instance!;
  }

  /// Réinitialise le magasin (tests uniquement).
  @visibleForTesting
  static void resetForTesting() => _instance = null;

  static LocalStore get instance {
    final store = _instance;
    if (store == null) {
      throw StateError('LocalStore.init() doit être appelé avant utilisation.');
    }
    return store;
  }

  String? getString(String key) => _prefs.getString(key);
  Future<void> setString(String key, String value) => _prefs.setString(key, value);
  int? getInt(String key) => _prefs.getInt(key);
  Future<void> setInt(String key, int value) => _prefs.setInt(key, value);
  bool? getBool(String key) => _prefs.getBool(key);
  Future<void> setBool(String key, bool value) => _prefs.setBool(key, value);
  Future<void> remove(String key) => _prefs.remove(key);

  dynamic getJson(String key) {
    final raw = _prefs.getString(key);
    if (raw == null) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  Future<void> setJson(String key, Object? value) =>
      _prefs.setString(key, jsonEncode(value));
}
