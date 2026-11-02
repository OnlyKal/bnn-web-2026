import '../../core/utils/formatters.dart';
import '../../core/utils/json_utils.dart';

enum ActionType { insertion, modification }

extension ActionTypeLabels on ActionType {
  String get label => this == ActionType.insertion ? 'Ajout' : 'Modification';
  String get pluralLabel => this == ActionType.insertion ? 'Ajouts' : 'Modifications';
}

class StatsResource {
  const StatsResource({required this.id, required this.title, this.type = '', this.domain = ''});

  final String id;
  final String title;
  final String type;
  final String domain;
}

/// Ligne normalisée du rapport (une action d'un utilisateur à une date).
class ActionRow {
  const ActionRow({
    required this.id,
    required this.type,
    required this.userId,
    required this.userLabel,
    required this.count,
    required this.date,
    required this.time,
    required this.resource,
    required this.resourceId,
    required this.resources,
  });

  final String id;
  final ActionType type;
  final String userId;
  final String userLabel;
  final int count;
  final String date;
  final String time;
  final String resource;
  final String resourceId;
  final List<StatsResource> resources;

  String get userKey => userId.isNotEmpty ? userId : userLabel;

  String get resourcesLabel =>
      resources.length > 1 ? resources.map((r) => r.title).join(', ') : resource;
}

class UserTotal {
  UserTotal(this.label);

  final String label;
  int insertions = 0;
  int modifications = 0;
  int get total => insertions + modifications;
}

class ChartItem {
  const ChartItem(this.key, this.label, this.value);

  final String key;
  final String label;
  final int value;
}

/// Normalisation des réponses de `/ressources/statistiques-actions/`
/// (logique reprise de `StatistiquesActionsPage.jsx`).
class ActionStatsParser {
  ActionStatsParser._();

  static String _userLabel(Json item) {
    final user = item['utilisateur'] ?? item['user'] ?? item['created_by'] ?? item['updated_by'];
    if (user is String && user.isNotEmpty) return user;
    if (user is Map) {
      final map = Map<String, dynamic>.from(user);
      final full = [pickString(map, ['prenom']), pickString(map, ['nom'])].whereType<String>().join(' ').trim();
      if (full.isNotEmpty) return full;
      return pickString(map, ['username', 'email', 'nom_complet']) ?? 'Utilisateur non renseigné';
    }
    return pickString(item, ['utilisateur_nom', 'nom_utilisateur', 'username', 'email', 'auteur']) ??
        'Utilisateur non renseigné';
  }

  static String _userId(Json item) {
    final user = item['utilisateur'] ?? item['user'] ?? item['created_by'] ?? item['updated_by'];
    if (user is Map) return pickString(Map<String, dynamic>.from(user), ['id', 'pk', 'uuid']) ?? '';
    return pickString(item, ['utilisateur_id', 'user_id', 'auteur_id']) ?? '';
  }

  static String _date(Json item) =>
      pickString(item, ['date', 'jour', 'date_action', 'created_at', 'updated_at', 'timestamp']) ?? '';

  static String _time(Json item, String date) =>
      pickString(item, ['heure', 'time', 'heure_action']) ?? (date.contains('T') ? date : '');

  static int _count(Json item) {
    for (final key in ['total', 'nombre', 'count', 'actions_count', 'nb_actions', 'valeur']) {
      final value = asInt(item[key]);
      if (value != null) return value;
    }
    return 1;
  }

  static String _title(Json r) => pickString(r, ['titre', 'title', 'nom', 'libelle', 'name']) ?? 'Ressource';

  static (String, String) _resourceInfo(Json item) {
    final resource = item['ressource'] ?? item['resource'] ?? item['document'];
    if (resource is Map) {
      final map = Map<String, dynamic>.from(resource);
      return (
        pickString(map, ['id', 'pk', 'uuid']) ?? pickString(item, ['ressource_id', 'resource_id']) ?? '',
        _title(map),
      );
    }
    return (
      pickString(item, ['ressource_id', 'resource_id']) ?? '',
      pickString(item, ['ressource_titre', 'titre']) ?? (resource is String ? resource : null) ?? 'Ressource',
    );
  }

  static List<StatsResource> _resources(Json item) {
    List<dynamic>? list;
    for (final key in ['ressources', 'resources', 'documents', 'liste_ressources', 'ressources_concernees']) {
      final value = item[key];
      if (value is List && value.isNotEmpty) {
        list = value;
        break;
      }
    }
    list ??= [item['ressource'] ?? item['resource'] ?? item['document'] ?? item];
    final unique = <String, StatsResource>{};
    for (final raw in list) {
      if (raw == null) continue;
      final StatsResource r;
      if (raw is Map) {
        final map = Map<String, dynamic>.from(raw);
        final domain = map['domaine'];
        r = StatsResource(
          id: pickString(map, ['id', 'pk', 'uuid', 'ressource_id', 'resource_id']) ??
              pickString(item, ['ressource_id', 'resource_id']) ??
              '',
          title: _title(map),
          type: pickString(map, ['type', 'type_ressource', 'format']) ?? '',
          domain: domain is Map ? (pickString(Map<String, dynamic>.from(domain), ['nom']) ?? '') : (domain?.toString() ?? ''),
        );
      } else {
        r = StatsResource(id: pickString(item, ['ressource_id', 'resource_id']) ?? '', title: raw.toString());
      }
      unique.putIfAbsent(r.id.isNotEmpty ? r.id : r.title, () => r);
    }
    return unique.values.toList();
  }

  static ActionRow _row(Json item, ActionType type, String id, {int? count}) {
    final date = _date(item);
    final (resourceId, resource) = _resourceInfo(item);
    return ActionRow(
      id: id,
      type: type,
      userId: _userId(item),
      userLabel: _userLabel(item),
      count: count ?? _count(item),
      date: date,
      time: _time(item, date),
      resource: resource,
      resourceId: resourceId,
      resources: _resources(item),
    );
  }

  static List<ActionRow> parse(dynamic payload) {
    final actions = asJson(asJson(payload)?['actions']) ?? const {};
    final rows = <ActionRow>[];
    for (final type in ActionType.values) {
      final stats = asJson(actions[type.name])?['statistiques'];
      if (stats is! List) continue;
      for (final (index, raw) in stats.indexed) {
        final item = asJson(raw);
        if (item == null) continue;
        final details = item['actions'] ?? item['details'] ?? item['activites'] ?? item['items'];
        if (details is List && details.isNotEmpty) {
          for (final (detailIndex, detail) in details.indexed) {
            final detailMap = asJson(detail) ?? const {};
            final merged = {...item, ...detailMap};
            final detailCount = _count(detailMap);
            rows.add(_row(merged, type, '${type.name}-$index-$detailIndex', count: detailCount == 0 ? 1 : detailCount));
          }
        } else {
          rows.add(_row(item, type, '${type.name}-$index'));
        }
      }
    }
    return rows;
  }

  static String dateKey(String value) {
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(value);
    if (match != null) return match.group(0)!;
    final date = DateTime.tryParse(value)?.toLocal();
    if (date == null) return 'unknown';
    return formatInputDate(date);
  }

  static List<UserTotal> userTotals(List<ActionRow> rows) {
    final users = <String, UserTotal>{};
    for (final row in rows) {
      final user = users.putIfAbsent(row.userKey, () => UserTotal(row.userLabel));
      if (row.type == ActionType.insertion) {
        user.insertions += row.count;
      } else {
        user.modifications += row.count;
      }
    }
    return users.values.toList()..sort((a, b) => b.total.compareTo(a.total));
  }

  static List<ChartItem> byUser(List<ActionRow> rows, {int limit = 8}) {
    final grouped = <String, (String, int)>{};
    for (final row in rows) {
      final current = grouped[row.userKey];
      grouped[row.userKey] = (row.userLabel, (current?.$2 ?? 0) + row.count);
    }
    final items = grouped.entries.map((e) => ChartItem(e.key, e.value.$1, e.value.$2)).toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return items.take(limit).toList();
  }

  static List<ChartItem> byPeriod(List<ActionRow> rows) {
    final grouped = <String, int>{};
    for (final row in rows) {
      final key = dateKey(row.date);
      grouped[key] = (grouped[key] ?? 0) + row.count;
    }
    final keys = grouped.keys.toList()..sort();
    return [
      for (final key in keys)
        ChartItem(key, key == 'unknown' ? 'Date inconnue' : formatShortDate(key), grouped[key]!),
    ];
  }
}
