import 'package:intl/intl.dart';

const _locale = 'fr_FR';

DateTime? parseDate(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  final dateOnly = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value.trim());
  if (dateOnly != null) {
    return DateTime(
      int.parse(dateOnly.group(1)!),
      int.parse(dateOnly.group(2)!),
      int.parse(dateOnly.group(3)!),
    );
  }
  return DateTime.tryParse(value)?.toLocal();
}

String _capitalize(String value) =>
    value.isEmpty ? value : value[0].toUpperCase() + value.substring(1);

/// « 15 janvier 2024 »
String formatLongDate(String? value, {String fallback = 'Date inconnue'}) {
  final date = parseDate(value);
  if (date == null) return value?.isNotEmpty == true ? value! : fallback;
  return DateFormat('d MMMM y', _locale).format(date);
}

/// « 15 janv. 2024 »
String formatShortDate(String? value, {String fallback = ''}) {
  final date = parseDate(value);
  if (date == null) return value?.isNotEmpty == true ? value! : fallback;
  return DateFormat('d MMM y', _locale).format(date);
}

/// « Mercredi 29 octobre 2026 »
String formatToday(DateTime date) =>
    _capitalize(DateFormat('EEEE d MMMM y', _locale).format(date));

String formatInputDate(DateTime date) => DateFormat('yyyy-MM-dd').format(date);

String formatTime(String? value) {
  if (value == null || value.isEmpty) return '';
  if (value.contains('T')) {
    final date = DateTime.tryParse(value)?.toLocal();
    if (date != null) return DateFormat('HH:mm', _locale).format(date);
  }
  return value.length >= 5 ? value.substring(0, 5) : value;
}

String formatNumber(num value) => NumberFormat.decimalPattern(_locale).format(value);

/// Séparateur de jour pour les conversations : « Aujourd'hui », « Hier »…
String formatDayLabel(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(date.year, date.month, date.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return "Aujourd'hui";
  if (diff == 1) return 'Hier';
  return _capitalize(DateFormat('EEEE d MMMM y', _locale).format(date));
}

String formatRelativeTime(DateTime date) {
  final diff = DateTime.now().difference(date);
  final minutes = diff.inMinutes;
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return 'Il y a $minutes min';
  final hours = diff.inHours;
  if (hours < 24) return 'Il y a $hours h';
  final days = diff.inDays;
  if (days < 7) return 'Il y a $days j';
  return DateFormat('d MMM y', _locale).format(date);
}

String? formatFileSize(int? bytes) {
  if (bytes == null || bytes <= 0) return null;
  const units = ['o', 'Ko', 'Mo', 'Go'];
  var size = bytes.toDouble();
  var unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return '${size.toStringAsFixed(size < 10 ? 2 : 1)} ${units[unit]}';
}

String plural(int count, String singular, [String? pluralForm]) =>
    count > 1 ? (pluralForm ?? '${singular}s') : singular;
