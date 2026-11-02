import 'package:flutter/foundation.dart';

import '../core/storage/local_store.dart';
import '../core/utils/json_utils.dart';
import '../data/models/history_item.dart';
import '../data/models/ressource.dart';

/// Historique local des activités (stocké uniquement sur l'appareil),
/// équivalent de `utils/localHistory.js`.
class HistoryController extends ChangeNotifier {
  HistoryController() {
    _load();
  }

  static const _historyKey = 'bnnLocalHistory:v1';
  static const _seenKey = 'bnnLocalHistorySeenAt:v1';
  static const maxItems = 50;

  List<HistoryItem> _items = [];
  int _seenAt = 0;

  List<HistoryItem> get items => List.unmodifiable(_items);
  int get unseenCount =>
      _items.where((item) => item.timestamp.millisecondsSinceEpoch > _seenAt).length;

  void _load() {
    final store = LocalStore.instance;
    final raw = store.getJson(_historyKey);
    _items = raw is List
        ? raw.whereType<Map>().map((e) => HistoryItem.fromJson(Map<String, dynamic>.from(e))).toList()
        : [];
    _seenAt = store.getInt(_seenKey) ?? 0;
  }

  void add({
    required String type,
    required String title,
    String description = '',
    String? target,
    Json metadata = const {},
  }) {
    final key = metadata['resourceId'] ?? metadata['salonId'] ?? metadata['query'] ?? target ?? title;
    final item = HistoryItem(
      id: '$type:${key.toString().trim().toLowerCase()}',
      type: type,
      title: title.trim().isEmpty ? 'Activité' : title.trim(),
      description: description.trim(),
      target: target,
      timestamp: DateTime.now(),
      metadata: metadata,
    );
    _items = [item, ..._items.where((e) => e.id != item.id)].take(maxItems).toList();
    _persist();
  }

  /// Raccourci pour enregistrer la consultation d'une ressource.
  void addResource(Ressource ressource, {String? description, String type = HistoryType.resource, String? action}) {
    add(
      type: type,
      title: ressource.titre,
      description: description ?? ressource.domaineNom ?? ressource.typeLabel,
      target: HistoryTarget.resource,
      metadata: {
        'resourceId': ressource.key,
        'resource': ressource.toJson(),
        'externalSource': ?(ressource.isExternal ? 'HAL' : null),
        'action': ?action,
      },
    );
  }

  void remove(String id) {
    _items = _items.where((e) => e.id != id).toList();
    _persist();
  }

  void clear() {
    _items = [];
    markSeen(notify: false);
    _persist();
  }

  void markSeen({bool notify = true}) {
    _seenAt = DateTime.now().millisecondsSinceEpoch;
    LocalStore.instance.setInt(_seenKey, _seenAt);
    if (notify) notifyListeners();
  }

  void _persist() {
    LocalStore.instance.setJson(_historyKey, _items.map((e) => e.toJson()).toList());
    notifyListeners();
  }
}
