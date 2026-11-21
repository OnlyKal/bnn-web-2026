import '../../core/utils/json_utils.dart';

/// Source suivie par l'API des consultations.
class ConsultationSource {
  const ConsultationSource(this.code, this.label);

  final String code;
  final String label;

  static const bnnInterne = ConsultationSource('bnn_interne', 'BNN interne');
  static const hal = ConsultationSource('hal', 'HAL');
  static const openAlex = ConsultationSource('openalex', 'OpenAlex');
  static const all = [bnnInterne, hal, openAlex];

  static String labelOf(String code) =>
      all.where((s) => s.code == code).map((s) => s.label).firstOrNull ?? code;

  static List<ConsultationSource> parseList(dynamic raw) {
    if (raw is! List) return all;
    final list = raw
        .whereType<Map>()
        .map((e) => ConsultationSource(e['code']?.toString() ?? '', e['libelle']?.toString() ?? ''))
        .where((s) => s.code.isNotEmpty)
        .map((s) => s.label.isEmpty ? ConsultationSource(s.code, labelOf(s.code)) : s)
        .toList();
    return list.isEmpty ? all : list;
  }
}

/// Période prédéfinie de l'API (`periode`).
class ConsultationPeriod {
  const ConsultationPeriod(this.code, this.label);

  final String code;
  final String label;

  static const aujourdhui = ConsultationPeriod('aujourdhui', "Aujourd'hui");
  static const hier = ConsultationPeriod('hier', 'Hier');
  static const cetteSemaine = ConsultationPeriod('cette_semaine', 'Cette semaine');
  static const semainePassee = ConsultationPeriod('semaine_passee', 'Semaine passée');
  static const ceMois = ConsultationPeriod('ce_mois', 'Ce mois');
  static const moisPasse = ConsultationPeriod('mois_passe', 'Mois passé');
  static const intervalle = ConsultationPeriod('intervalle', 'Intervalle');

  static const all = [aujourdhui, hier, cetteSemaine, semainePassee, ceMois, moisPasse, intervalle];

  /// Périodes renvoyées par le résumé (`statistiques/` sans `periode`).
  static const summary = [aujourdhui, hier, semainePassee, moisPasse];
}

/// Type de consultation compté (`action`).
enum ConsultationAction {
  recherche('recherche', 'Recherche / liste', 'Recherches'),
  detail('detail', 'Fiche détaillée', 'Fiches'),
  pdf('pdf', 'Ouverture de fichier / PDF', 'Fichiers / PDF');

  const ConsultationAction(this.code, this.label, this.shortLabel);

  final String code;
  final String label;
  final String shortLabel;

  static ConsultationAction? fromCode(String? code) =>
      values.where((a) => a.code == code).firstOrNull;
}

/// Bornes d'une période calculées par le serveur.
class PeriodInfo {
  const PeriodInfo({required this.code, required this.label, this.dateDebut, this.dateFin});

  final String code;
  final String label;
  final String? dateDebut;
  final String? dateFin;

  static PeriodInfo? fromJson(dynamic raw) {
    final json = asJson(raw);
    if (json == null) return null;
    return PeriodInfo(
      code: json['code']?.toString() ?? '',
      label: json['libelle']?.toString() ?? '',
      dateDebut: json['date_debut']?.toString(),
      dateFin: json['date_fin']?.toString(),
    );
  }
}

/// Une carte du résumé (aujourd'hui, hier, semaine passée, mois passé).
class PeriodSummary {
  const PeriodSummary({
    required this.code,
    required this.label,
    required this.total,
    required this.bySource,
    this.dateDebut,
    this.dateFin,
  });

  final String code;
  final String label;
  final int total;
  final Map<String, int> bySource;
  final String? dateDebut;
  final String? dateFin;
}

/// Bloc `diagnostic` du résumé : état de l'enregistrement côté serveur.
class ConsultationDiagnostic {
  const ConsultationDiagnostic({
    required this.middlewareActif,
    required this.ecriturePossible,
    this.erreurEcriture,
    this.dernierEnregistrement,
  });

  final bool middlewareActif;
  final bool ecriturePossible;
  final String? erreurEcriture;
  final String? dernierEnregistrement;

  bool get ok => middlewareActif && ecriturePossible;
}

class ConsultationSummary {
  const ConsultationSummary({required this.sources, required this.periods, this.diagnostic});

  final List<ConsultationSource> sources;
  final List<PeriodSummary> periods;
  final ConsultationDiagnostic? diagnostic;

  factory ConsultationSummary.fromJson(Json json) {
    final periodes = asJson(json['periodes']) ?? const {};
    final periods = <PeriodSummary>[];
    for (final p in ConsultationPeriod.summary) {
      final item = asJson(periodes[p.code]);
      if (item == null) continue;
      final bySource = asJson(item['par_source']) ?? const {};
      periods.add(PeriodSummary(
        code: p.code,
        label: item['libelle']?.toString() ?? p.label,
        total: asInt(item['total']) ?? 0,
        bySource: bySource.map((k, v) => MapEntry(k, asInt(v) ?? 0)),
        dateDebut: item['date_debut']?.toString(),
        dateFin: item['date_fin']?.toString(),
      ));
    }
    final diag = asJson(json['diagnostic']);
    return ConsultationSummary(
      sources: ConsultationSource.parseList(json['sources']),
      periods: periods,
      diagnostic: diag == null
          ? null
          : ConsultationDiagnostic(
              middlewareActif: asBool(diag['middleware_actif']),
              ecriturePossible: asBool(diag['ecriture_possible']),
              erreurEcriture: diag['erreur_ecriture']?.toString(),
              dernierEnregistrement: diag['dernier_enregistrement']?.toString(),
            ),
    );
  }
}

/// Totaux d'une source, répartis par type de consultation.
class SourceBreakdown {
  const SourceBreakdown({required this.code, required this.label, required this.total, required this.byAction});

  final String code;
  final String label;
  final int total;
  final Map<ConsultationAction, int> byAction;

  int of(ConsultationAction action) => byAction[action] ?? 0;
}

class DailyConsultations {
  const DailyConsultations({required this.date, required this.bySource, required this.total});

  final String date;
  final Map<String, int> bySource;
  final int total;
}

class TopResource {
  const TopResource(this.id, this.consultations);

  final String id;
  final int consultations;
}

/// Statistiques détaillées d'une période (`statistiques/?periode=…`).
class ConsultationStats {
  const ConsultationStats({
    required this.period,
    required this.sources,
    required this.total,
    required this.uniqueVisitors,
    required this.bySource,
    required this.daily,
    required this.top,
  });

  final PeriodInfo? period;
  final List<ConsultationSource> sources;
  final int total;
  final int uniqueVisitors;
  final List<SourceBreakdown> bySource;
  final List<DailyConsultations> daily;
  final Map<String, List<TopResource>> top;

  int actionTotal(ConsultationAction action) => bySource.fold(0, (sum, s) => sum + s.of(action));

  DailyConsultations? get busiestDay {
    DailyConsultations? best;
    for (final d in daily) {
      if (best == null || d.total > best.total) best = d;
    }
    return best;
  }

  double get dailyAverage => daily.isEmpty ? 0 : total / daily.length;

  factory ConsultationStats.fromJson(Json json) {
    final sources = ConsultationSource.parseList(json['sources']);
    final parSource = asJson(json['par_source']) ?? const {};
    final topJson = asJson(json['top_ressources']) ?? const {};
    final parJour = json['par_jour'] is List ? json['par_jour'] as List : const [];

    return ConsultationStats(
      period: PeriodInfo.fromJson(json['periode']),
      sources: sources,
      total: asInt(json['total']) ?? 0,
      uniqueVisitors: asInt(json['visiteurs_uniques']) ?? 0,
      bySource: [
        for (final s in sources)
          () {
            final item = asJson(parSource[s.code]) ?? const {};
            return SourceBreakdown(
              code: s.code,
              label: item['libelle']?.toString() ?? s.label,
              total: asInt(item['total']) ?? 0,
              byAction: {for (final a in ConsultationAction.values) a: asInt(item[a.code]) ?? 0},
            );
          }(),
      ],
      daily: [
        for (final row in parJour.whereType<Map>())
          DailyConsultations(
            date: row['date']?.toString() ?? '',
            bySource: {for (final s in sources) s.code: asInt(row[s.code]) ?? 0},
            total: asInt(row['total']) ?? 0,
          ),
      ],
      top: {
        for (final s in sources)
          s.code: [
            for (final item in (topJson[s.code] is List ? topJson[s.code] as List : const []).whereType<Map>())
              TopResource(item['ressource_id']?.toString() ?? '', asInt(item['consultations']) ?? 0),
          ],
      },
    );
  }
}

/// Une ligne du journal (`/api/consultations/`).
class ConsultationEntry {
  const ConsultationEntry({
    required this.id,
    required this.date,
    required this.source,
    required this.sourceLabel,
    required this.action,
    required this.actionLabel,
    this.resourceId,
    this.userId,
  });

  final String id;
  final String date;
  final String source;
  final String sourceLabel;
  final ConsultationAction? action;
  final String actionLabel;
  final String? resourceId;
  final int? userId;

  factory ConsultationEntry.fromJson(Json json) {
    final source = json['source']?.toString() ?? '';
    final action = ConsultationAction.fromCode(json['action']?.toString());
    final resource = json['ressource_id']?.toString();
    return ConsultationEntry(
      id: json['id']?.toString() ?? '',
      date: json['date']?.toString() ?? '',
      source: source,
      sourceLabel: json['source_libelle']?.toString() ?? ConsultationSource.labelOf(source),
      action: action,
      actionLabel: json['action_libelle']?.toString() ?? action?.label ?? json['action']?.toString() ?? '',
      resourceId: resource == null || resource.isEmpty ? null : resource,
      userId: asInt(json['utilisateur_id']),
    );
  }
}

class ConsultationPage {
  const ConsultationPage({required this.count, required this.items, required this.hasNext});

  final int count;
  final List<ConsultationEntry> items;
  final bool hasNext;
}
