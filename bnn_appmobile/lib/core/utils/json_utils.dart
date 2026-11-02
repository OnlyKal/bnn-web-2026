/// Helpers tolérants aux différentes formes de réponses de l'API BNN
/// (`data`, `results`, `results.data`, tableau brut...).
typedef Json = Map<String, dynamic>;

List<Json> extractList(dynamic response) {
  List<dynamic>? raw;
  if (response is List) {
    raw = response;
  } else if (response is Map) {
    final data = response['data'];
    final results = response['results'];
    if (data is List) {
      raw = data;
    } else if (results is List) {
      raw = results;
    } else if (results is Map && results['data'] is List) {
      raw = results['data'] as List;
    }
  }
  return (raw ?? const [])
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}

Json? extractObject(dynamic response) {
  if (response is! Map) return null;
  final data = response['data'];
  if (data is Map) return Map<String, dynamic>.from(data);
  return Map<String, dynamic>.from(response);
}

/// Retourne la première valeur non vide (convertie en texte) parmi [keys].
String? pickString(Json? source, List<String> keys) {
  if (source == null) return null;
  for (final key in keys) {
    final value = source[key];
    if (value == null) continue;
    if (value is Map || value is List) continue;
    final text = value.toString().trim();
    if (text.isNotEmpty) return text;
  }
  return null;
}

Json? asJson(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : null;

int? asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

bool asBool(dynamic value) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return ['true', '1', 'yes', 'oui'].contains(value.toLowerCase());
  return false;
}
