import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/network/api_exception.dart';
import '../data/models/ressource.dart';
import '../data/services/ressources_service.dart';

class TypeCount {
  const TypeCount(this.type, this.label, this.count);

  final String type; // 'all' pour « Tous »
  final String label;
  final int count;
}

class SearchSuggestion {
  const SearchSuggestion(this.text, this.kind);

  final String text;
  final String kind; // titre, sous_titre, domaine, sous_domaine

  String get kindLabel => switch (kind) {
        'titre' => 'Titre',
        'sous_titre' => 'Sous-titre',
        'domaine' => 'Domaine',
        _ => 'Sous-domaine',
      };
}

/// Logique de l'accueil « Ressources internes » : liste paginée, filtres par
/// type et domaine, recherche serveur (avec repli local) et suggestions.
class InternalResourcesController extends ChangeNotifier {
  InternalResourcesController(this._service, {this.debounce = const Duration(milliseconds: 500)});

  final RessourcesService _service;
  final Duration debounce;

  // Navigation (liste paginée).
  List<Ressource> _browse = [];
  String? _nextCursor;
  int _totalCount = 0;
  bool _countLoaded = false;
  Map<String, int> _serverTypeCounts = {};
  bool loading = true;
  bool loadingMore = false;
  String? error;

  // Filtres.
  String activeType = 'all';
  Domaine? selectedDomain;
  List<Ressource>? _domainItems;
  List<Domaine> domaines = [];
  bool loadingDomaines = true;

  // Recherche.
  String query = '';
  bool get isSearchMode => query.trim().length >= 2;
  List<Ressource> _searchResults = [];
  int searchTotal = 0;
  bool _searchHasNext = false;
  int _searchOffset = 0;
  bool searchLoading = false;
  String? searchError;
  Timer? _debounceTimer;
  int _searchToken = 0;

  /// Appelé après une recherche validée (pour l'historique).
  void Function(String query)? onSearchCommitted;

  int get totalCount => _totalCount;
  bool get countLoaded => _countLoaded;
  bool get canLoadMore => isSearchMode
      ? _searchHasNext && !searchLoading
      : selectedDomain == null && _nextCursor != null && !loadingMore;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }

  Future<void> init() async {
    await Future.wait([_loadFirstPage(), _loadDomaines()]);
  }

  Future<void> refresh() async {
    _service.invalidateCache();
    _domainItems = null;
    await Future.wait([
      _loadFirstPage(),
      _loadDomaines(),
      if (selectedDomain != null) _loadDomain(selectedDomain!),
      if (isSearchMode) _runSearch(query, 0),
    ]);
  }

  Future<void> _loadFirstPage() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final page = await _service.list(type: activeType == 'all' ? null : activeType);
      _browse = page.items;
      _nextCursor = page.nextCursor;
      if (activeType == 'all') {
        _totalCount = page.totalCount;
        _countLoaded = true;
        if (page.typeCounts.isNotEmpty) _serverTypeCounts = page.typeCounts;
      }
    } on ApiException catch (e) {
      error = e.message;
      _browse = [];
      _nextCursor = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> _loadDomaines() async {
    loadingDomaines = true;
    notifyListeners();
    try {
      domaines = await _service.domaines();
    } on ApiException {
      domaines = [];
    } finally {
      loadingDomaines = false;
      notifyListeners();
    }
  }

  Future<void> loadMore() async {
    if (isSearchMode) {
      if (_searchHasNext) await _runSearch(query, _searchOffset + RessourcesService.searchPageSize);
      return;
    }
    if (!canLoadMore) return;
    loadingMore = true;
    notifyListeners();
    try {
      final page = await _service.list(cursor: _nextCursor, type: activeType == 'all' ? null : activeType);
      final known = _browse.map((e) => e.id).toSet();
      _browse = [..._browse, ...page.items.where((e) => !known.contains(e.id))];
      _nextCursor = page.nextCursor;
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      loadingMore = false;
      notifyListeners();
    }
  }

  // ---------- Filtres ----------

  Future<void> selectType(String type) async {
    if (activeType == type) return;
    activeType = type;
    notifyListeners();
    // En recherche ou par domaine, le filtrage par type est local.
    if (!isSearchMode && selectedDomain == null) await _loadFirstPage();
  }

  Future<void> selectDomain(Domaine? domaine) async {
    if (domaine == null || selectedDomain?.id == domaine.id) {
      selectedDomain = null;
      _domainItems = null;
      notifyListeners();
      return;
    }
    selectedDomain = domaine;
    await _loadDomain(domaine);
  }

  Future<void> _loadDomain(Domaine domaine) async {
    loading = true;
    _domainItems = null;
    notifyListeners();
    try {
      _domainItems = await _service.byDomaine(domaine.id);
    } on ApiException {
      // Repli : filtrage local sur les ressources chargées (comportement Web).
      _domainItems = _browse.where((r) => _inDomain(r, domaine)).toList();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  static bool _inDomain(Ressource r, Domaine d) =>
      r.domaineId == d.id || (r.domaineNom?.toLowerCase() == d.nom.toLowerCase());

  // ---------- Recherche ----------

  void setQuery(String value) {
    query = value;
    _debounceTimer?.cancel();
    if (!isSearchMode) {
      _searchResults = [];
      searchError = null;
      searchLoading = false;
      _searchToken++;
      notifyListeners();
      return;
    }
    searchLoading = true;
    notifyListeners();
    _debounceTimer = Timer(debounce, () {
      onSearchCommitted?.call(value.trim());
      _runSearch(value, 0);
    });
  }

  void clearSearch() {
    setQuery('');
    activeType = 'all';
    notifyListeners();
  }

  Future<void> _runSearch(String value, int offset) async {
    final token = ++_searchToken;
    searchLoading = true;
    searchError = null;
    notifyListeners();
    try {
      final page = await _service.search(value, offset: offset);
      if (token != _searchToken) return;
      var items = page.items;
      var total = page.totalCount;
      var hasNext = page.hasNext;
      // Repli local si le serveur ne trouve rien (comportement Web).
      if (offset == 0 && items.isEmpty) {
        items = _localSearch(value);
        total = items.length;
        hasNext = false;
      }
      _searchResults = offset == 0 ? items : [..._searchResults, ...items];
      searchTotal = total;
      _searchHasNext = hasNext;
      _searchOffset = offset;
    } on ApiException catch (e) {
      if (token != _searchToken) return;
      final local = offset == 0 ? _localSearch(value) : <Ressource>[];
      if (local.isNotEmpty) {
        _searchResults = local;
        searchTotal = local.length;
        _searchHasNext = false;
      } else if (offset == 0) {
        _searchResults = [];
        searchError = e.message;
      }
    } finally {
      if (token == _searchToken) {
        searchLoading = false;
        notifyListeners();
      }
    }
  }

  List<Ressource> _localSearch(String value) {
    final q = value.toLowerCase().trim();
    return _browse.where((r) {
      return r.titre.toLowerCase().contains(q) ||
          (r.sousTitre?.toLowerCase().contains(q) ?? false) ||
          (r.description?.toLowerCase().contains(q) ?? false) ||
          (r.domaineNom?.toLowerCase().contains(q) ?? false) ||
          (r.sousDomaineNom?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  /// Suggestions issues des ressources chargées (titres, sous-titres, domaines).
  List<SearchSuggestion> get suggestions {
    final q = query.toLowerCase().trim();
    if (q.length < 2) return const [];
    final seen = <String>{};
    final result = <SearchSuggestion>[];
    void add(String? text, String kind) {
      if (text == null || !text.toLowerCase().contains(q) || !seen.add(text)) return;
      result.add(SearchSuggestion(text, kind));
    }

    for (final r in [..._browse, ...?_domainItems]) {
      add(r.titre, 'titre');
      add(r.sousTitre, 'sous_titre');
      add(r.domaineNom, 'domaine');
      add(r.sousDomaineNom, 'sous_domaine');
      if (result.length >= 24) break;
    }
    result.sort((a, b) {
      final ae = a.text.toLowerCase() == q ? 0 : 1;
      final be = b.text.toLowerCase() == q ? 0 : 1;
      return ae.compareTo(be);
    });
    return result.take(6).toList();
  }

  // ---------- Données affichées ----------

  List<Ressource> get _base {
    if (isSearchMode) return _searchResults;
    if (selectedDomain != null) return _domainItems ?? const [];
    return _browse;
  }

  /// Ressources visibles, filtrées par type puis triées domaine / type / titre.
  List<Ressource> get visible {
    var items = _base;
    final localTypeFilter = isSearchMode || selectedDomain != null;
    if (activeType != 'all' && localTypeFilter) {
      items = items.where((r) => (r.type ?? '').toLowerCase().trim() == activeType).toList();
    }
    if (isSearchMode) return items;
    final sorted = [...items];
    sorted.sort((a, b) {
      final d = (a.domaineNom ?? '').toLowerCase().compareTo((b.domaineNom ?? '').toLowerCase());
      if (d != 0) return d;
      final t = (a.type ?? '').toLowerCase().compareTo((b.type ?? '').toLowerCase());
      if (t != 0) return t;
      return a.titre.toLowerCase().compareTo(b.titre.toLowerCase());
    });
    return sorted;
  }

  /// Les 5 ressources les plus récentes (date de publication).
  List<Ressource> get recent {
    final dated = _browse.where((r) => r.datePublication != null).toList()
      ..sort((a, b) => (b.datePublication ?? '').compareTo(a.datePublication ?? ''));
    return dated.take(5).toList();
  }

  /// Compteurs par type : serveur en navigation, calculés sinon.
  List<TypeCount> get typeCounts {
    final dynamicCounts = isSearchMode || selectedDomain != null;
    final counts = <String, int>{for (final t in ResourceTypes.all) t: 0};
    int total;
    if (dynamicCounts) {
      for (final r in _base) {
        final t = (r.type ?? '').toLowerCase().trim();
        if (counts.containsKey(t)) counts[t] = counts[t]! + 1;
      }
      total = isSearchMode ? searchTotal : _base.length;
    } else {
      counts.addAll(_serverTypeCounts);
      total = _totalCount;
    }
    final types = ResourceTypes.all
        .map((t) => TypeCount(t, ResourceTypes.label(t), counts[t] ?? 0))
        .toList()
      ..sort((a, b) => a.label.compareTo(b.label));
    return [TypeCount('all', 'Tous', total), ...types];
  }
}
