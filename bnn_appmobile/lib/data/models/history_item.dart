import '../../core/utils/json_utils.dart';

/// Catégories d'historique (identiques au Web).
class HistoryType {
  HistoryType._();

  static const resource = 'resource';
  static const favorite = 'favorite';
  static const salon = 'salon';
  static const search = 'search';
  static const page = 'page';
  static const action = 'action';
  static const other = 'other';

  static String label(String type) => switch (type) {
        resource => 'Ressources',
        favorite => 'Favoris',
        salon => 'Salons',
        search => 'Recherches',
        page => 'Pages',
        _ => 'Autres',
      };
}

/// Destinations ouvrables depuis l'historique.
class HistoryTarget {
  HistoryTarget._();

  static const resource = 'resource'; // metadata.resource = snapshot
  static const home = 'tab:home';
  static const favorites = 'tab:favorites';
  static const salons = 'tab:salons';
  static const history = 'tab:history';
  static const profile = 'tab:profile';
  static const rdc = 'tab:rdc';
  static const statistics = 'statistics';
  static const consultations = 'consultations';
  static const homeSearch = 'search:home'; // metadata.query
  static const openAlex = 'openalex'; // metadata.workId
}

class HistoryItem {
  HistoryItem({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.target,
    required this.timestamp,
    this.metadata = const {},
  });

  factory HistoryItem.fromJson(Json json) => HistoryItem(
        id: json['id']?.toString() ?? '',
        type: json['type']?.toString() ?? HistoryType.other,
        title: json['title']?.toString() ?? 'Activité',
        description: json['description']?.toString() ?? '',
        target: json['target']?.toString(),
        timestamp: DateTime.fromMillisecondsSinceEpoch(asInt(json['timestamp']) ?? 0),
        metadata: asJson(json['metadata']) ?? const {},
      );

  final String id;
  final String type;
  final String title;
  final String description;
  final String? target;
  final DateTime timestamp;
  final Json metadata;

  Json toJson() => {
        'id': id,
        'type': type,
        'title': title,
        'description': description,
        'target': target,
        'timestamp': timestamp.millisecondsSinceEpoch,
        'metadata': metadata,
      };
}
