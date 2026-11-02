import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/utils/json_utils.dart';
import '../models/ressource.dart';

class RessourcesPage {
  RessourcesPage({
    required this.items,
    required this.totalCount,
    required this.typeCounts,
    this.nextCursor,
  });

  final List<Ressource> items;
  final int totalCount;

  /// Nombre de ressources par type (clés de `ResourceTypes`), si fourni par l'API.
  final Map<String, int> typeCounts;
  final String? nextCursor;

  bool get hasNext => nextCursor != null;
}

class SearchPage {
  SearchPage({required this.items, required this.totalCount, required this.offset, required this.limit, required this.hasNext});

  final List<Ressource> items;
  final int totalCount;
  final int offset;
  final int limit;
  final bool hasNext;
}

class _CacheEntry<T> {
  _CacheEntry(this.value, this.expiresAt);
  final T value;
  final DateTime expiresAt;
}

/// Ressources internes BNN (`/ressources/`, `/ressources/search/`, `/domaines/`…).
class RessourcesService {
  RessourcesService(this._client);

  final ApiClient _client;
  final Map<String, _CacheEntry<Object>> _cache = {};

  static const searchPageSize = 50;

  Future<T> _cached<T extends Object>(String key, Duration ttl, Future<T> Function() loader) async {
    final entry = _cache[key];
    if (entry != null && entry.expiresAt.isAfter(DateTime.now())) return entry.value as T;
    final value = await loader();
    _cache[key] = _CacheEntry(value, DateTime.now().add(ttl));
    return value;
  }

  void invalidateCache() => _cache.clear();

  static String? _cursorFrom(dynamic next) {
    if (next is! String || next.isEmpty) return null;
    return Uri.tryParse(next)?.queryParameters['cursor'];
  }

  RessourcesPage _parsePage(dynamic data) {
    final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final items = extractList(map['results'] ?? map).map(Ressource.fromJson).toList();
    final counts = <String, int>{};
    for (final type in ResourceTypes.all) {
      final value = asInt(map[type]);
      if (value != null) counts[type] = value;
    }
    return RessourcesPage(
      items: items,
      totalCount: asInt(map['count']) ?? items.length,
      typeCounts: counts,
      nextCursor: _cursorFrom(map['next']),
    );
  }

  /// Page de ressources (pagination par curseur), éventuellement filtrée par type.
  Future<RessourcesPage> list({String? cursor, String? type}) async {
    try {
      final response = await _client.dio.get<dynamic>(
        '/ressources/',
        queryParameters: {'cursor': ?cursor, 'type': ?type},
      );
      return _parsePage(response.data);
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors du chargement des ressources');
    }
  }

  Future<SearchPage> search(String query, {int offset = 0}) async {
    try {
      final response = await _client.dio.get<dynamic>(
        '/ressources/search/',
        queryParameters: {'q': query.trim(), 'limit': searchPageSize, 'offset': offset},
      );
      final data = response.data;
      final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      final items = extractList(data).map(Ressource.fromJson).toList();
      return SearchPage(
        items: items,
        totalCount: asInt(map['total_count']) ?? items.length,
        offset: asInt(map['offset']) ?? offset,
        limit: asInt(map['limit']) ?? searchPageSize,
        hasNext: asBool(map['has_next']),
      );
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors de la recherche');
    }
  }

  Future<List<Domaine>> domaines() => _cached('domaines', const Duration(minutes: 15), () async {
        try {
          final response = await _client.dio.get<dynamic>('/domaines/');
          return extractList(response.data).map(Domaine.fromJson).toList();
        } catch (e) {
          throw ApiException.from(e, fallback: 'Erreur lors du chargement des domaines');
        }
      });

  Future<List<Ressource>> byDomaine(String domaineId) =>
      _cached('domaine:$domaineId', const Duration(minutes: 10), () async {
        try {
          final response = await _client.dio.get<dynamic>('/domaines/$domaineId/ressources/');
          final data = response.data;
          final list = data is Map && data['results'] is Map ? data['results'] : data;
          return extractList(list).map(Ressource.fromJson).toList();
        } catch (e) {
          throw ApiException.from(e, fallback: 'Erreur lors du chargement des ressources du domaine');
        }
      });

  /// Toutes les ressources (appel lourd, mis en cache 10 minutes).
  Future<List<Ressource>> all() => _cached('all', const Duration(minutes: 10), () async {
        try {
          final response = await _client.dio.get<dynamic>('/ressource/all/');
          final data = response.data;
          final list = data is Map && data['results'] is Map ? data['results'] : data;
          return extractList(list).map(Ressource.fromJson).toList();
        } catch (e) {
          throw ApiException.from(e, fallback: 'Erreur lors du chargement des ressources');
        }
      });

  /// Retrouve une ressource par identifiant (aucun endpoint dédié côté API :
  /// même stratégie que le Web, première page puis liste complète).
  Future<Ressource?> findById(String id) async {
    final firstPage = await list();
    for (final r in firstPage.items) {
      if (r.id == id) return r;
    }
    for (final r in await all()) {
      if (r.id == id) return r;
    }
    return null;
  }

  /// Enregistre une consultation (statistiques) ; n'interrompt jamais l'action.
  Future<void> recordConsultation(String ressourceId) async {
    try {
      await _client.dio.post<dynamic>(
        '/consultations/',
        data: {'ressource_id': int.tryParse(ressourceId) ?? ressourceId},
      );
    } catch (_) {}
  }
}
