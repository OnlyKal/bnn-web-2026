import 'package:flutter/foundation.dart';

import '../core/network/api_exception.dart';
import '../core/storage/local_store.dart';
import '../core/utils/json_utils.dart';
import '../data/models/ressource.dart';
import '../data/services/favoris_service.dart';

enum FavoritesStatus { idle, loading, ready, error }

/// Favoris de l'utilisateur : favoris internes (serveur) et favoris HAL
/// (stockés localement par compte, comme `utils/externalFavorites.js`).
class FavoritesController extends ChangeNotifier {
  FavoritesController(this._service);

  final FavorisService _service;

  String _identity = 'anonymous';
  List<Ressource> _internal = [];
  List<Ressource> _external = [];
  FavoritesStatus _status = FavoritesStatus.idle;
  String? _error;
  final Set<String> _pending = {};

  FavoritesStatus get status => _status;
  String? get error => _error;
  List<Ressource> get all => [..._internal, ..._external];
  int get count => _internal.length + _external.length;
  bool isPending(Ressource r) => _pending.contains(r.key);

  bool isFavorite(Ressource ressource) => ressource.isExternal
      ? _external.any((e) => e.externalId == ressource.externalId)
      : _internal.any((e) => e.id == ressource.id);

  String get _externalKey => 'bnnExternalFavorites:v1:${Uri.encodeComponent(_identity)}';

  /// Associe le contrôleur à l'utilisateur connecté et charge ses favoris.
  Future<void> bindUser(String identity) async {
    if (_identity == identity && _status != FavoritesStatus.idle) return;
    _identity = identity;
    _internal = [];
    _loadExternal();
    await refresh();
  }

  void _loadExternal() {
    final raw = LocalStore.instance.getJson(_externalKey);
    _external = raw is List
        ? raw
            .whereType<Map>()
            .map((e) => asJson(e['ressource']))
            .whereType<Json>()
            .map((json) => Ressource.fromJson({...json, 'externalSource': 'HAL'}))
            .toList()
        : [];
  }

  Future<void> _saveExternal() => LocalStore.instance.setJson(
        _externalKey,
        _external
            .map((r) => {'id': 'HAL:${r.externalId}', 'externalSource': 'HAL', 'ressource': r.toJson()})
            .toList(),
      );

  Future<void> refresh() async {
    _status = FavoritesStatus.loading;
    _error = null;
    notifyListeners();
    try {
      _internal = await _service.list();
      _status = FavoritesStatus.ready;
    } on ApiException catch (e) {
      _error = e.message;
      // Les favoris HAL restent consultables même si le serveur est indisponible.
      _status = _external.isEmpty ? FavoritesStatus.error : FavoritesStatus.ready;
    }
    notifyListeners();
  }

  /// Ajoute ou retire [ressource] ; retourne le nouvel état (favori ou non).
  Future<bool> toggle(Ressource ressource) async {
    final wasFavorite = isFavorite(ressource);
    if (wasFavorite) {
      await remove(ressource);
    } else {
      await add(ressource);
    }
    return !wasFavorite;
  }

  Future<void> add(Ressource ressource) async {
    if (ressource.isExternal) {
      if (!isFavorite(ressource)) _external = [ressource, ..._external];
      await _saveExternal();
      notifyListeners();
      return;
    }
    _pending.add(ressource.key);
    notifyListeners();
    try {
      await _service.add(ressource.id);
      if (!isFavorite(ressource)) _internal = [..._internal, ressource];
    } on ApiException catch (e) {
      if (e.statusCode == 409 && !isFavorite(ressource)) {
        _internal = [..._internal, ressource];
      } else {
        rethrow;
      }
    } finally {
      _pending.remove(ressource.key);
      notifyListeners();
    }
  }

  Future<void> remove(Ressource ressource) async {
    if (ressource.isExternal) {
      _external = _external.where((e) => e.externalId != ressource.externalId).toList();
      await _saveExternal();
      notifyListeners();
      return;
    }
    _pending.add(ressource.key);
    notifyListeners();
    try {
      await _service.remove(ressource.id);
      _internal = _internal.where((e) => e.id != ressource.id).toList();
    } finally {
      _pending.remove(ressource.key);
      notifyListeners();
    }
  }

  void reset() {
    _identity = 'anonymous';
    _internal = [];
    _external = [];
    _status = FavoritesStatus.idle;
    notifyListeners();
  }
}
