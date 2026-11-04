import 'package:flutter/foundation.dart';

import '../core/network/api_exception.dart';
import '../data/models/openalex.dart';
import '../data/services/openalex_service.dart';

/// Catalogue OpenAlex : rubrique active, filtres et pagination (20 par page,
/// dans la limite des 10 000 premiers résultats imposée par OpenAlex).
class OpenAlexController extends ChangeNotifier {
  OpenAlexController(this._service);

  final OpenAlexService _service;

  OpenAlexCatalog catalog = OpenAlexCatalog.books;
  OpenAlexFilters filters = const OpenAlexFilters();
  List<OpenAlexWork> items = [];
  int total = 0;
  int _page = 1;
  int _maxPage = 1;
  bool _hasNext = false;
  bool loading = true;
  bool loadingMore = false;
  String? error;
  String? loadMoreError;
  int _requestId = 0;
  bool _initialized = false;

  bool get hasMore => _hasNext && _page < _maxPage;

  /// Vrai quand la limite de pagination d'OpenAlex est atteinte alors qu'il reste des résultats.
  bool get reachedLimit => !hasMore && items.length < total && items.isNotEmpty;

  /// Nombre de filtres actifs (hors recherche et rubrique), pour la pastille du bouton « Filtres ».
  int get activeFilterCount => [
        filters.language.isNotEmpty,
        filters.yearFrom.isNotEmpty,
        filters.yearTo.isNotEmpty,
        filters.openAccessOnly,
        !filters.pdfOnly,
        filters.author.isNotEmpty,
        filters.sort.isNotEmpty,
      ].where((active) => active).length;

  void init() {
    if (_initialized) return;
    _initialized = true;
    _search();
  }

  void selectCatalog(OpenAlexCatalog next) {
    if (next == catalog) return;
    catalog = next;
    _search();
  }

  void apply(OpenAlexFilters next) {
    // Le domaine n'existe que sur le catalogue PDF : il est retiré si l'on inclut les publications sans PDF.
    filters = next.pdfOnly ? next : next.copyWith(categories: const []);
    _search();
  }

  /// Filtre par domaine › discipline › sous-discipline (réactive le catalogue PDF si besoin).
  void selectCategories(List<OpenAlexCategoryRef> categories) {
    apply(filters.copyWith(categories: categories, pdfOnly: categories.isNotEmpty ? true : filters.pdfOnly));
  }

  Future<void> retry() => _search();

  /// Toujours revenir à la page 1 ; une réponse obsolète (filtre changé entre-temps) est ignorée.
  Future<void> _search() async {
    final id = ++_requestId;
    loading = true;
    error = null;
    loadMoreError = null;
    notifyListeners();
    try {
      final page = await _service.works(catalog, filters);
      if (id != _requestId) return;
      items = page.items;
      total = page.total;
      _page = page.page;
      _hasNext = page.hasNext;
      _maxPage = page.maxAccessiblePage;
    } on ApiException catch (e) {
      if (id != _requestId) return;
      items = [];
      total = 0;
      _hasNext = false;
      error = e.message;
    } finally {
      if (id == _requestId) {
        loading = false;
        notifyListeners();
      }
    }
  }

  /// [manual] : relance demandée par l'utilisateur après un échec (le défilement
  /// seul ne relance pas, pour ne pas épuiser le quota de requêtes).
  Future<void> loadMore({bool manual = false}) async {
    if (loading || loadingMore || !hasMore) return;
    if (loadMoreError != null && !manual) return;
    final id = _requestId;
    loadingMore = true;
    loadMoreError = null;
    notifyListeners();
    try {
      final page = await _service.works(catalog, filters, page: _page + 1);
      if (id != _requestId) return;
      _page = page.page;
      _hasNext = page.hasNext;
      _maxPage = page.maxAccessiblePage;
      final known = items.map((e) => e.id).toSet();
      items = [...items, ...page.items.where((e) => !known.contains(e.id))];
    } on ApiException catch (e) {
      if (id == _requestId) loadMoreError = e.message;
    } finally {
      loadingMore = false;
      notifyListeners();
    }
  }
}
