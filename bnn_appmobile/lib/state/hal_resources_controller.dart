import 'package:flutter/foundation.dart';

import '../core/network/api_exception.dart';
import '../data/models/ressource.dart';
import '../data/services/hal_service.dart';

/// Recherche et filtrage des ressources HAL (pagination par pages de 10).
class HalResourcesController extends ChangeNotifier {
  HalResourcesController(this._service);

  final HalService _service;

  HalFilters filters = const HalFilters();
  List<Ressource> items = [];
  int total = 0;
  int _page = 1;
  bool loading = true;
  bool loadingMore = false;
  String? error;

  List<HalDomain> domaines = [];
  bool loadingDomaines = true;
  bool _initialized = false;
  int _requestId = 0;

  bool get hasMore => items.length < total;
  int get totalPages => total == 0 ? 1 : (total / HalService.pageSize).ceil();

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      filters = await _service.defaultFilters();
    } on ApiException {
      // Filtres par défaut locaux si le service méta ne répond pas.
    }
    await Future.wait([_search(), _loadDomaines()]);
  }

  Future<void> apply(HalFilters next) async {
    final domainContextChanged = next.language != filters.language || next.docType != filters.docType;
    filters = next;
    await Future.wait([_search(), if (domainContextChanged) _loadDomaines()]);
  }

  Future<void> retry() => _search();

  Future<void> _search() async {
    final id = ++_requestId;
    loading = true;
    error = null;
    _page = 1;
    notifyListeners();
    try {
      final page = await _service.ouvrages(filters, page: 1);
      if (id != _requestId) return;
      items = page.items;
      total = page.total;
    } on ApiException catch (e) {
      if (id != _requestId) return;
      items = [];
      total = 0;
      error = e.message;
    } finally {
      if (id == _requestId) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadMore() async {
    if (loading || loadingMore || !hasMore) return;
    final id = _requestId;
    loadingMore = true;
    notifyListeners();
    try {
      final page = await _service.ouvrages(filters, page: _page + 1);
      if (id != _requestId) return;
      _page++;
      final known = items.map((e) => e.externalId).toSet();
      items = [...items, ...page.items.where((e) => !known.contains(e.externalId))];
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      loadingMore = false;
      notifyListeners();
    }
  }

  Future<void> _loadDomaines() async {
    loadingDomaines = true;
    notifyListeners();
    try {
      domaines = await _service.domaines(language: filters.language, docType: filters.docType);
    } on ApiException {
      domaines = [];
    } finally {
      loadingDomaines = false;
      notifyListeners();
    }
  }

  String domainName(String code) {
    for (final d in domaines) {
      if (d.code == code) return d.name;
    }
    return code;
  }
}
