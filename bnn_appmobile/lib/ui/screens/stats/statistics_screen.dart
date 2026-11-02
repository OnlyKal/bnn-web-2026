import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/action_stats.dart';
import '../../../data/models/history_item.dart';
import '../../../data/services/stats_export_service.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/states.dart';
import '../resource/resource_navigation.dart';

/// Couleurs validées (contraste, daltonisme) pour les deux catégories du rapport.
const _insertionColor = Color(0xFF2F5BD3);
const _modificationColor = Color(0xFFD97706);

Color _typeColor(ActionType t) => t == ActionType.insertion ? _insertionColor : _modificationColor;

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  final _export = StatsExportService();
  final _search = TextEditingController();
  late DateTimeRange _range = _defaultRange();
  String? _userKey;
  ActionType? _type;
  String _query = '';
  List<ActionRow> _rows = [];
  bool _loading = true;
  String? _error;
  String? _exporting;
  CancelToken? _cancel;

  static DateTimeRange _defaultRange() {
    final now = DateTime.now();
    final end = DateTime(now.year, now.month, now.day);
    return DateTimeRange(start: end.subtract(const Duration(days: 6)), end: end);
  }

  @override
  void initState() {
    super.initState();
    if (context.read<SessionController>().user?.isAdmin ?? false) _load();
  }

  @override
  void dispose() {
    _cancel?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    _cancel?.cancel();
    final cancel = _cancel = CancelToken();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await context.read<AppServices>().stats.actions(
            dateDebut: formatInputDate(_range.start),
            dateFin: formatInputDate(_range.end),
            cancelToken: cancel,
          );
      if (mounted && !cancel.isCancelled) setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (mounted && !cancel.isCancelled) setState(() => _error = e.message);
    } finally {
      if (mounted && !cancel.isCancelled) setState(() => _loading = false);
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: _range,
      helpText: 'Période du rapport',
      saveText: 'Appliquer',
    );
    if (picked == null || !mounted) return;
    setState(() => _range = picked);
    context.read<HistoryController>().add(
          type: HistoryType.action,
          title: 'Filtrage statistiques',
          description: 'Recherche dans le rapport des ajouts et modifications',
          target: HistoryTarget.statistics,
        );
    _load();
  }

  void _reset() {
    _search.clear();
    setState(() {
      _range = _defaultRange();
      _userKey = null;
      _type = null;
      _query = '';
    });
    _load();
  }

  List<({String key, String label})> get _userOptions {
    final users = <String, String>{};
    for (final r in _rows) {
      users.putIfAbsent(r.userKey, () => r.userLabel);
    }
    return users.entries.map((e) => (key: e.key, label: e.value)).toList()..sort((a, b) => a.label.compareTo(b.label));
  }

  List<ActionRow> get _filtered {
    final q = _query.trim().toLowerCase();
    return _rows.where((r) {
      if (_userKey != null && r.userKey != _userKey) return false;
      if (_type != null && r.type != _type) return false;
      if (q.isEmpty) return true;
      return r.userLabel.toLowerCase().contains(q) ||
          r.type.label.toLowerCase().contains(q) ||
          [r.resource, ...r.resources.map((e) => e.title)].any((t) => t.toLowerCase().contains(q));
    }).toList();
  }

  String _filtersLabel() {
    final parts = <String>[_type == null ? 'Ajouts et modifications' : _type!.pluralLabel];
    if (_userKey != null) {
      parts.add(_userOptions.where((u) => u.key == _userKey).map((u) => u.label).firstOrNull ?? 'Utilisateur sélectionné');
    }
    if (_query.trim().isNotEmpty) parts.add('Recherche : ${_query.trim()}');
    return parts.join(' - ');
  }

  Future<void> _exportAs(String format) async {
    setState(() => _exporting = format);
    final report = StatsReport(
      dateDebut: formatInputDate(_range.start),
      dateFin: formatInputDate(_range.end),
      rows: _filtered,
      filtersLabel: _filtersLabel(),
    );
    try {
      if (format == 'pdf') {
        final bytes = await _export.buildPdf(report);
        await _export.share(bytes, '${report.fileBase}.pdf', 'application/pdf');
      } else {
        final bytes = _export.buildExcel(report);
        await _export.share(bytes, '${report.fileBase}.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
    } catch (_) {
      if (mounted) {
        showError(context, format == 'pdf'
            ? 'Erreur lors de la génération du fichier PDF.'
            : 'Erreur lors de la génération du fichier Excel.');
      }
    } finally {
      if (mounted) setState(() => _exporting = null);
    }
  }

  void _showRowResources(ActionRow row) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (context, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Text('${row.type.label} · ${row.userLabel}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            Text(
              '${formatLongDate(row.date)}${row.time.isNotEmpty ? ' à ${formatTime(row.time)}' : ''} · ${row.count} action(s)',
              style: const TextStyle(color: AppColors.textMuted),
            ),
            const SizedBox(height: 14),
            const SectionHeader(title: 'Ressources concernées', icon: CupertinoIcons.doc_on_doc),
            for (final r in row.resources)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const IconTile(CupertinoIcons.doc_text, size: 36, iconSize: 18),
                title: Text(r.title),
                subtitle: [r.type, r.domain].where((e) => e.isNotEmpty).isEmpty
                    ? null
                    : Text([r.type, r.domain].where((e) => e.isNotEmpty).join(' · ')),
                trailing: r.id.isEmpty ? null : const Icon(CupertinoIcons.chevron_right, size: 16, color: AppColors.textFaint),
                onTap: r.id.isEmpty
                    ? null
                    : () {
                        Navigator.of(sheetContext).pop();
                        openRessourceById(context, r.id);
                      },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickUser(List<({String key, String label})> options) async {
    final picked = await showModalBottomSheet<({String? key})>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (context, scroll) => Column(
          children: [
            const SheetHeader(title: 'Utilisateur', subtitle: 'Filtrer le rapport par contributeur', icon: CupertinoIcons.person),
            const Divider(),
            Expanded(
              child: ListView(
                controller: scroll,
                children: [
                  for (final (key, label) in [(null, 'Tous les utilisateurs'), for (final u in options) (u.key, u.label)])
                    ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
                      title: Text(label,
                          style: TextStyle(color: key == _userKey ? AppColors.primary : AppColors.textPrimary)),
                      trailing: key == _userKey ? const Icon(CupertinoIcons.checkmark_alt, color: AppColors.primary) : null,
                      onTap: () => Navigator.of(sheetContext).pop((key: key)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    if (picked != null && mounted) setState(() => _userKey = picked.key);
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.select<SessionController, bool>((s) => s.user?.isAdmin ?? false);
    if (!isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Rapports statistiques')),
        body: const StatusView(
          icon: CupertinoIcons.lock,
          title: 'Accès réservé',
          message: 'Les rapports statistiques sont réservés aux administrateurs.',
        ),
      );
    }

    final rows = _filtered;
    final insertions = rows.where((r) => r.type == ActionType.insertion).fold(0, (s, r) => s + r.count);
    final modifications = rows.where((r) => r.type == ActionType.modification).fold(0, (s, r) => s + r.count);
    final users = rows.map((r) => r.userKey).toSet().length;
    final userOptions = _userOptions;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rapports statistiques'),
        actions: [
          IconButton(tooltip: 'Actualiser', onPressed: _loading ? null : _load, icon: const Icon(CupertinoIcons.arrow_clockwise)),
          PopupMenuButton<String>(
            tooltip: 'Exporter',
            position: PopupMenuPosition.under,
            enabled: !_loading && _exporting == null && _error == null,
            icon: _exporting != null
                ? const CupertinoActivityIndicator()
                : const Icon(CupertinoIcons.square_arrow_up, color: AppColors.primary),
            onSelected: _exportAs,
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'pdf', child: ListTile(leading: Icon(CupertinoIcons.doc_text_fill, color: AppColors.pdf), title: Text('Exporter en PDF'))),
              PopupMenuItem(value: 'excel', child: ListTile(leading: Icon(CupertinoIcons.table_fill, color: AppColors.successDark), title: Text('Exporter en Excel'))),
            ],
          ),
        ],
      ),
      body: AppRefresh(
        onRefresh: _load,
        child: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            _Card(
              title: 'Filtres du rapport',
              icon: CupertinoIcons.slider_horizontal_3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _FieldButton(
                    icon: CupertinoIcons.calendar,
                    label: 'Période',
                    value: 'Du ${formatShortDate(formatInputDate(_range.start))} au ${formatShortDate(formatInputDate(_range.end))}',
                    onTap: _pickRange,
                  ),
                  const SizedBox(height: 10),
                  _FieldButton(
                    icon: CupertinoIcons.person,
                    label: 'Utilisateur',
                    value: userOptions.where((u) => u.key == _userKey).map((u) => u.label).firstOrNull ??
                        'Tous les utilisateurs',
                    onTap: () => _pickUser(userOptions),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final (value, label) in const [
                        (null, 'Tous'),
                        (ActionType.insertion, 'Ajouts'),
                        (ActionType.modification, 'Modifications'),
                      ])
                        ChoiceChip(
                          label: Text(label),
                          selected: _type == value,
                          onSelected: (_) => setState(() => _type = value),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SearchField(
                    controller: _search,
                    hint: 'Utilisateur, ressource, action…',
                    onChanged: (v) => setState(() => _query = v),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(onPressed: _reset, icon: const Icon(CupertinoIcons.arrow_counterclockwise, size: 17), label: const Text('Réinitialiser')),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              ...List.generate(3, (_) => const Padding(padding: EdgeInsets.only(bottom: 12), child: Skeleton(height: 110, radius: 14)))
            else if (_error != null)
              StatusView.error(message: _error, onAction: _load)
            else ...[
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.7,
                children: [
                  _Kpi(icon: CupertinoIcons.plus_circle_fill, label: 'Ajouts', value: insertions, color: _insertionColor),
                  _Kpi(icon: CupertinoIcons.pencil_circle_fill, label: 'Modifications', value: modifications, color: _modificationColor),
                  _Kpi(icon: CupertinoIcons.chart_bar_alt_fill, label: 'Actions analysées', value: insertions + modifications),
                  _Kpi(icon: CupertinoIcons.person_3_fill, label: 'Utilisateurs actifs', value: users),
                ],
              ),
              const SizedBox(height: 16),
              if (rows.isEmpty)
                const StatusView(
                  icon: CupertinoIcons.chart_bar,
                  title: 'Aucune action sur cette période',
                  message: 'Modifiez la période ou les filtres pour afficher des résultats.',
                  compact: true,
                )
              else ...[
                _Card(
                  title: 'Répartition par type',
                  icon: CupertinoIcons.chart_pie,
                  child: Column(
                    children: [
                      _BarChart(items: [
                        ChartItem('insertion', 'Ajouts', insertions),
                        ChartItem('modification', 'Modifications', modifications),
                      ], colorFor: (item) => item.key == 'insertion' ? _insertionColor : _modificationColor),
                      const SizedBox(height: 8),
                      const _Legend(),
                    ],
                  ),
                ),
                _Card(
                  title: 'Actions par utilisateur',
                  icon: CupertinoIcons.person_2,
                  subtitle: '8 contributeurs les plus actifs',
                  child: _BarChart(items: ActionStatsParser.byUser(rows)),
                ),
                _Card(
                  title: 'Actions par jour',
                  icon: CupertinoIcons.calendar,
                  child: _BarChart(items: ActionStatsParser.byPeriod(rows)),
                ),
                _Card(
                  title: 'Totaux par utilisateur',
                  icon: CupertinoIcons.sum,
                  child: Column(
                    children: [
                      for (final u in ActionStatsParser.userTotals(rows))
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(child: Text(u.label, style: const TextStyle(fontWeight: FontWeight.w600))),
                              _Count(value: u.insertions, color: _insertionColor, tooltip: 'Ajouts'),
                              const SizedBox(width: 6),
                              _Count(value: u.modifications, color: _modificationColor, tooltip: 'Modifications'),
                              const SizedBox(width: 10),
                              SizedBox(
                                width: 40,
                                child: Text(formatNumber(u.total),
                                    textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                _Card(
                  title: 'Journal détaillé',
                  icon: CupertinoIcons.list_bullet,
                  subtitle: '${rows.length} ${plural(rows.length, 'ligne')}',
                  child: Column(
                    children: [
                      for (final (index, row) in rows.indexed) ...[
                        if (index > 0) const Divider(),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          onTap: () => _showRowResources(row),
                          leading: Semantics(
                            label: row.type.label,
                            child: IconTile(
                              row.type == ActionType.insertion ? CupertinoIcons.plus : CupertinoIcons.pencil,
                              color: _typeColor(row.type),
                              size: 38,
                              iconSize: 18,
                            ),
                          ),
                          title: Text(row.resourcesLabel, maxLines: 2, overflow: TextOverflow.ellipsis),
                          subtitle: Text(
                            '${row.type.label} · ${row.userLabel} · ${formatShortDate(row.date)}'
                            '${row.time.isNotEmpty ? ' ${formatTime(row.time)}' : ''}',
                          ),
                          trailing: Text('×${row.count}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.title, this.subtitle, this.icon});

  final Widget child;
  final String? title;
  final String? subtitle;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            SectionHeader(title: title!, subtitle: subtitle, icon: icon),
            const SizedBox(height: 12),
          ],
          child,
        ],
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.icon, required this.label, required this.value, this.color = AppColors.navy});

  final IconData icon;
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              IconTile(icon, color: color, size: 28, iconSize: 15),
              const SizedBox(width: 6),
              Expanded(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          Text(formatNumber(value), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.value, required this.color, required this.tooltip});

  final int value;
  final Color color;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Container(
        constraints: const BoxConstraints(minWidth: 36),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 4),
            Text(formatNumber(value), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    Widget entry(Color color, String label) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
          ],
        );
    return Wrap(spacing: 16, children: [entry(_insertionColor, 'Ajouts'), entry(_modificationColor, 'Modifications')]);
  }
}

/// Barres horizontales avec étiquettes directes (valeurs en encre de texte).
class _BarChart extends StatelessWidget {
  const _BarChart({required this.items, this.colorFor});

  final List<ChartItem> items;
  final Color Function(ChartItem item)? colorFor;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Text('Aucune donnée disponible pour ce graphique.', style: TextStyle(color: AppColors.textMuted));
    }
    final max = items.map((e) => e.value).fold(1, (a, b) => a > b ? a : b);
    return Column(
      children: [
        for (final item in items)
          Semantics(
            label: '${item.label} : ${item.value}',
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  SizedBox(
                    width: 110,
                    child: Text(item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, constraints) => Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          width: (constraints.maxWidth * item.value / max).clamp(2, constraints.maxWidth).toDouble(),
                          height: 14,
                          decoration: BoxDecoration(
                            color: colorFor?.call(item) ?? _insertionColor,
                            borderRadius: const BorderRadius.horizontal(right: Radius.circular(4)),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 40,
                    child: Text(formatNumber(item.value),
                        textAlign: TextAlign.right,
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Champ cliquable (libellé + valeur) ouvrant un sélecteur.
class _FieldButton extends StatelessWidget {
  const _FieldButton({required this.icon, required this.label, required this.value, required this.onTap});

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      onTap: onTap,
      radius: 12,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 19, color: AppColors.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
                Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const Icon(CupertinoIcons.chevron_down, size: 15, color: AppColors.textFaint),
        ],
      ),
    );
  }
}
