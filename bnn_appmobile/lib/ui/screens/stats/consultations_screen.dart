import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:excel/excel.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/consultation_stats.dart';
import '../../../data/models/history_item.dart';
import '../../../data/services/consultations_service.dart';
import '../../../data/services/stats_export_service.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/states.dart';
import '../resource/openalex_details_screen.dart';
import '../resource/resource_navigation.dart';

/// Couleurs des sources (identiques à la version Web).
Color sourceColor(String code) => switch (code) {
      'hal' => const Color(0xFFE8730C),
      'openalex' => const Color(0xFF0F9488),
      _ => AppColors.primary,
    };

Color _actionColor(ConsultationAction? a) => switch (a) {
      ConsultationAction.detail => AppColors.successDark,
      ConsultationAction.pdf => const Color(0xFFD97706),
      _ => AppColors.primary,
    };

IconData _actionIcon(ConsultationAction? a) => switch (a) {
      ConsultationAction.detail => CupertinoIcons.eye_fill,
      ConsultationAction.pdf => CupertinoIcons.doc_text_fill,
      _ => CupertinoIcons.search,
    };

double _percent(int value, int total) => total > 0 ? (value * 1000 / total).round() / 10 : 0;

String _formatRange(String? debut, String? fin) {
  if ((debut ?? '').isEmpty && (fin ?? '').isEmpty) return 'Toutes les dates';
  if (debut == fin) return formatShortDate(debut);
  return '${formatShortDate(debut)} → ${formatShortDate(fin)}';
}

String _formatDateTime(String value) {
  final date = formatShortDate(value);
  final time = formatTime(value);
  return time.isEmpty ? date : '$date · $time';
}

class ConsultationsScreen extends StatefulWidget {
  const ConsultationsScreen({super.key});

  @override
  State<ConsultationsScreen> createState() => _ConsultationsScreenState();
}

class _ConsultationsScreenState extends State<ConsultationsScreen> {
  static const _pageSize = 20;

  late final ConsultationsService _service = context.read<AppServices>().consultations;
  final _resourceSearch = TextEditingController();

  // Filtres
  String _period = ConsultationPeriod.cetteSemaine.code;
  List<String> _sources = ConsultationSource.all.map((s) => s.code).toList();
  late DateTimeRange _range = _defaultRange();

  // Résumé
  ConsultationSummary? _summary;
  bool _summaryLoading = true;
  String? _summaryError;

  // Statistiques détaillées
  ConsultationStats? _stats;
  bool _statsLoading = true;
  String? _statsError;

  // Journal
  ConsultationAction? _journalAction;
  String _journalResource = '';
  final List<ConsultationEntry> _entries = [];
  int _journalCount = 0;
  int _journalPage = 1;
  bool _journalHasNext = false;
  bool _journalLoading = true;
  bool _journalLoadingMore = false;
  String? _journalError;

  bool _exporting = false;
  CancelToken? _cancel;

  static DateTimeRange _defaultRange() {
    final now = DateTime.now();
    final end = DateTime(now.year, now.month, now.day);
    return DateTimeRange(start: end.subtract(const Duration(days: 29)), end: end);
  }

  ConsultationQuery get _query => ConsultationQuery(
        sources: _sources,
        period: _period,
        dateDebut: formatInputDate(_range.start),
        dateFin: formatInputDate(_range.end),
      );

  @override
  void initState() {
    super.initState();
    if (context.read<SessionController>().user?.isAdmin ?? false) _loadAll();
  }

  @override
  void dispose() {
    _cancel?.cancel();
    _resourceSearch.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    _cancel?.cancel();
    final token = _cancel = CancelToken();
    await Future.wait([_loadSummary(token), _loadStats(token), _loadJournal(token)]);
  }

  /// Recharge uniquement ce qui dépend de la période (le résumé ne dépend que des sources).
  Future<void> _reloadPeriod() async {
    _cancel?.cancel();
    final token = _cancel = CancelToken();
    await Future.wait([_loadStats(token), _loadJournal(token)]);
  }

  Future<void> _loadSummary(CancelToken token) async {
    setState(() {
      _summaryLoading = true;
      _summaryError = null;
    });
    try {
      final summary = await _service.summary(_sources, cancelToken: token);
      if (!mounted || token.isCancelled) return;
      setState(() => _summary = summary);
    } catch (e) {
      if (!mounted || token.isCancelled) return;
      setState(() => _summaryError = ApiException.from(e).message);
    } finally {
      if (mounted && !token.isCancelled) setState(() => _summaryLoading = false);
    }
  }

  Future<void> _loadStats(CancelToken token) async {
    setState(() {
      _statsLoading = true;
      _statsError = null;
    });
    try {
      final stats = await _service.statistics(_query, cancelToken: token);
      if (!mounted || token.isCancelled) return;
      setState(() => _stats = stats);
    } catch (e) {
      if (!mounted || token.isCancelled) return;
      setState(() {
        _stats = null;
        _statsError = ApiException.from(e).message;
      });
    } finally {
      if (mounted && !token.isCancelled) setState(() => _statsLoading = false);
    }
  }

  Future<void> _loadJournal(CancelToken token, {bool more = false}) async {
    setState(() {
      if (more) {
        _journalLoadingMore = true;
      } else {
        _journalLoading = true;
        _journalError = null;
      }
    });
    try {
      final page = await _service.list(
        _query,
        action: _journalAction?.code,
        resourceId: _journalResource,
        page: more ? _journalPage + 1 : 1,
        pageSize: _pageSize,
        cancelToken: token,
      );
      if (!mounted || token.isCancelled) return;
      setState(() {
        if (!more) _entries.clear();
        _entries.addAll(page.items);
        _journalCount = page.count;
        _journalHasNext = page.hasNext;
        _journalPage = more ? _journalPage + 1 : 1;
      });
    } catch (e) {
      if (!mounted || token.isCancelled) return;
      if (more) {
        showError(context, ApiException.from(e).message);
      } else {
        setState(() {
          _entries.clear();
          _journalError = ApiException.from(e).message;
        });
      }
    } finally {
      if (mounted && !token.isCancelled) {
        setState(() {
          _journalLoading = false;
          _journalLoadingMore = false;
        });
      }
    }
  }

  Future<void> _reloadJournal() => _loadJournal(_cancel ?? (_cancel = CancelToken()));

  void _logAction(String description) {
    context.read<HistoryController>().add(
          type: HistoryType.action,
          title: 'Statistiques de consultation',
          description: description,
          target: HistoryTarget.consultations,
        );
  }

  void _selectPeriod(String code) {
    if (code == _period && code != ConsultationPeriod.intervalle.code) return;
    if (code == ConsultationPeriod.intervalle.code) {
      _pickRange();
      return;
    }
    setState(() => _period = code);
    _logAction('Période : ${ConsultationPeriod.all.firstWhere((p) => p.code == code).label}');
    _reloadPeriod();
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year, now.month, now.day),
      initialDateRange: _range,
      helpText: 'Intervalle des consultations',
      saveText: 'Appliquer',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _range = picked;
      _period = ConsultationPeriod.intervalle.code;
    });
    _logAction('Intervalle : ${_formatRange(formatInputDate(picked.start), formatInputDate(picked.end))}');
    _reloadPeriod();
  }

  void _toggleSource(String code) {
    final next = _sources.contains(code)
        ? _sources.where((s) => s != code).toList()
        : ConsultationSource.all.map((s) => s.code).where((s) => s == code || _sources.contains(s)).toList();
    if (next.isEmpty) {
      showInfo(context, 'Au moins une source doit rester sélectionnée.');
      return;
    }
    setState(() => _sources = next);
    _loadAll();
  }

  void _setJournalAction(ConsultationAction? action) {
    setState(() => _journalAction = action);
    _reloadJournal();
  }

  void _filterJournalByResource(String id) {
    _resourceSearch.text = id;
    setState(() => _journalResource = id);
    _reloadJournal();
    showInfo(context, 'Journal filtré sur la ressource $id');
  }

  Future<void> _openResource(String source, String id) async {
    if (id.isEmpty) return;
    switch (source) {
      case 'openalex':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OpenAlexDetailsScreen(workId: id)));
      case 'hal':
        try {
          final ressource = await context.read<AppServices>().hal.ouvrage(id);
          if (mounted) await openRessourceDetails(context, ressource);
        } catch (e) {
          if (mounted) showError(context, ApiException.from(e).message);
        }
      default:
        await openRessourceById(context, id);
    }
  }

  Future<void> _exportExcel() async {
    final stats = _stats;
    if (stats == null) return;
    setState(() => _exporting = true);
    try {
      final bytes = _buildExcel(stats);
      final code = stats.period?.code ?? _period;
      final start = stats.period?.dateDebut ?? formatInputDate(DateTime.now());
      await StatsExportService().share(
        bytes,
        'consultations_${code}_$start.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch (_) {
      if (mounted) showError(context, 'Erreur lors de la génération du fichier Excel.');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Uint8List _buildExcel(ConsultationStats stats) {
    final excel = Excel.createExcel();
    final defaultSheet = excel.getDefaultSheet();
    final bold = CellStyle(bold: true, fontColorHex: ExcelColor.fromHexString('#073B70'));
    final header = CellStyle(
      bold: true,
      fontColorHex: ExcelColor.white,
      backgroundColorHex: ExcelColor.fromHexString('#1E42AC'),
    );

    void preamble(Sheet sheet, String heading) {
      for (final line in StatsExportService.institutionHeader) {
        sheet.appendRow([TextCellValue(line)]);
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: sheet.maxRows - 1)).cellStyle = bold;
      }
      sheet.appendRow([TextCellValue('')]);
      sheet.appendRow([TextCellValue(heading)]);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: sheet.maxRows - 1)).cellStyle = bold;
      sheet.appendRow([
        TextCellValue('Période : ${stats.period?.label ?? ''} '
            '(${_formatRange(stats.period?.dateDebut, stats.period?.dateFin)})'),
      ]);
      sheet.appendRow([TextCellValue('Généré le ${DateFormat('d MMMM y à HH:mm', 'fr_FR').format(DateTime.now())}')]);
      sheet.appendRow([TextCellValue('')]);
    }

    void headerRow(Sheet sheet, List<String> labels) {
      sheet.appendRow(labels.map(TextCellValue.new).toList());
      final row = sheet.maxRows - 1;
      for (var i = 0; i < labels.length; i++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: row)).cellStyle = header;
      }
    }

    final resume = excel['Synthèse'];
    preamble(resume, 'STATISTIQUES DES CONSULTATIONS');
    headerRow(resume, ['Indicateur', 'Valeur']);
    resume.appendRow([TextCellValue('Consultations'), IntCellValue(stats.total)]);
    resume.appendRow([TextCellValue('Visiteurs uniques'), IntCellValue(stats.uniqueVisitors)]);
    for (final a in ConsultationAction.values) {
      resume.appendRow([TextCellValue(a.label), IntCellValue(stats.actionTotal(a))]);
    }
    resume.appendRow([TextCellValue('')]);
    headerRow(resume, ['Source', 'Recherches', 'Fiches', 'Fichiers / PDF', 'Total', 'Part (%)']);
    for (final s in stats.bySource) {
      resume.appendRow([
        TextCellValue(s.label),
        for (final a in ConsultationAction.values) IntCellValue(s.of(a)),
        IntCellValue(s.total),
        DoubleCellValue(_percent(s.total, stats.total)),
      ]);
    }
    resume.setColumnWidth(0, 30);
    for (var i = 1; i < 6; i++) {
      resume.setColumnWidth(i, 15);
    }

    final jours = excel['Par jour'];
    preamble(jours, 'CONSULTATIONS PAR JOUR');
    headerRow(jours, ['Date', ...stats.sources.map((s) => s.label), 'Total']);
    for (final d in stats.daily) {
      jours.appendRow([
        TextCellValue(d.date),
        for (final s in stats.sources) IntCellValue(d.bySource[s.code] ?? 0),
        IntCellValue(d.total),
      ]);
    }
    jours.setColumnWidth(0, 14);

    final top = excel['Top ressources'];
    preamble(top, 'RESSOURCES LES PLUS CONSULTÉES (FICHES)');
    headerRow(top, ['Source', 'Rang', 'Identifiant', 'Consultations']);
    for (final s in stats.sources) {
      for (final (i, item) in (stats.top[s.code] ?? const <TopResource>[]).indexed) {
        top.appendRow([TextCellValue(s.label), IntCellValue(i + 1), TextCellValue(item.id), IntCellValue(item.consultations)]);
      }
    }
    top.setColumnWidth(0, 18);
    top.setColumnWidth(2, 30);

    const names = ['Synthèse', 'Par jour', 'Top ressources'];
    if (defaultSheet != null && !names.contains(defaultSheet)) excel.delete(defaultSheet);
    excel.setDefaultSheet('Synthèse');
    final bytes = excel.encode();
    if (bytes == null) throw StateError('Le fichier Excel n’a pas pu être généré.');
    return Uint8List.fromList(bytes);
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.select<SessionController, bool>((s) => s.user?.isAdmin ?? false);
    if (!isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Consultations')),
        body: const StatusView(
          icon: CupertinoIcons.lock,
          title: 'Accès réservé',
          message: 'Les statistiques de consultation sont réservées aux administrateurs.',
        ),
      );
    }

    final stats = _stats;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Consultations'),
        actions: [
          IconButton(
            tooltip: 'Actualiser',
            onPressed: _statsLoading || _summaryLoading ? null : _loadAll,
            icon: const Icon(CupertinoIcons.arrow_clockwise),
          ),
          IconButton(
            tooltip: 'Exporter en Excel',
            onPressed: stats == null || _exporting || _statsLoading ? null : _exportExcel,
            icon: _exporting
                ? const CupertinoActivityIndicator()
                : const Icon(CupertinoIcons.square_arrow_up, color: AppColors.primary),
          ),
        ],
      ),
      body: AppRefresh(
        onRefresh: _loadAll,
        child: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            _buildSummary(),
            if (_summary?.diagnostic != null) _DiagnosticBanner(diagnostic: _summary!.diagnostic!),
            _buildFilters(),
            if (_statsLoading)
              ...List.generate(3, (_) => const Padding(padding: EdgeInsets.only(bottom: 12), child: Skeleton(height: 120, radius: 14)))
            else if (_statsError != null)
              StatusView.error(message: _statsError, onAction: _reloadPeriod, compact: true)
            else if (stats != null) ...[
              _buildKpis(stats),
              const SizedBox(height: 14),
              _buildActions(stats),
              _buildChart(stats),
              _buildSources(stats),
              _buildTop(stats),
            ],
            _buildJournal(),
          ],
        ),
      ),
    );
  }

  // ---------- Résumé des périodes ----------

  Widget _buildSummary() {
    if (_summaryError != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: StatusView.error(message: _summaryError, onAction: () => _loadSummary(_cancel ?? CancelToken()), compact: true),
      );
    }
    final periods = _summary?.periods ?? const <PeriodSummary>[];
    return SizedBox(
      height: 150,
      child: _summaryLoading && periods.isEmpty
          ? ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 4,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, _) => const Skeleton(width: 190, height: 140, radius: 14),
            )
          : ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: periods.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              padding: const EdgeInsets.only(bottom: 10),
              itemBuilder: (_, i) {
                final p = periods[i];
                return SizedBox(
                  width: 190,
                  child: _PeriodCard(
                    summary: p,
                    sources: _sources,
                    selected: p.code == _period,
                    onTap: () => _selectPeriod(p.code),
                  ),
                );
              },
            ),
    );
  }

  // ---------- Filtres ----------

  Widget _buildFilters() {
    final info = _stats?.period;
    return _Card(
      title: 'Période et sources',
      icon: CupertinoIcons.slider_horizontal_3,
      subtitle: info == null ? null : _formatRange(info.dateDebut, info.dateFin),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final p in ConsultationPeriod.all)
                ChoiceChip(
                  label: Text(p.label),
                  selected: _period == p.code,
                  onSelected: (_) => _selectPeriod(p.code),
                ),
            ],
          ),
          if (_period == ConsultationPeriod.intervalle.code) ...[
            const SizedBox(height: 10),
            _FieldButton(
              icon: CupertinoIcons.calendar,
              label: 'Intervalle personnalisé',
              value: 'Du ${formatShortDate(formatInputDate(_range.start))} au ${formatShortDate(formatInputDate(_range.end))}',
              onTap: _pickRange,
            ),
          ],
          const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1)),
          const Text('Sources', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in ConsultationSource.all)
                FilterChip(
                  avatar: _Dot(color: sourceColor(s.code)),
                  label: Text(s.label),
                  selected: _sources.contains(s.code),
                  showCheckmark: false,
                  onSelected: (_) => _toggleSource(s.code),
                ),
            ],
          ),
        ],
      ),
    );
  }

  // ---------- Indicateurs ----------

  Widget _buildKpis(ConsultationStats stats) {
    final busiest = stats.busiestDay;
    final avg = (stats.dailyAverage * 10).round() / 10;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.6,
      children: [
        _Kpi(icon: CupertinoIcons.chart_bar_alt_fill, label: 'Consultations', value: formatNumber(stats.total)),
        _Kpi(icon: CupertinoIcons.person_3_fill, label: 'Visiteurs uniques', value: formatNumber(stats.uniqueVisitors), color: AppColors.violet),
        _Kpi(icon: CupertinoIcons.calendar, label: 'Moyenne / jour', value: formatNumber(avg), color: AppColors.successDark),
        _Kpi(
          icon: CupertinoIcons.flame_fill,
          label: 'Jour le plus actif',
          value: formatNumber(busiest?.total ?? 0),
          caption: busiest != null && busiest.total > 0 ? formatShortDate(busiest.date) : 'Aucune activité',
          color: const Color(0xFFD97706),
        ),
      ],
    );
  }

  Widget _buildActions(ConsultationStats stats) {
    return _Card(
      title: 'Types de consultation',
      icon: CupertinoIcons.square_stack_3d_up,
      child: Column(
        children: [
          for (final a in ConsultationAction.values)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  IconTile(_actionIcon(a), color: _actionColor(a), size: 34, iconSize: 16),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text(a.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                            Text(formatNumber(stats.actionTotal(a)), style: const TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(width: 6),
                            SizedBox(
                              width: 48,
                              child: Text('${_percent(stats.actionTotal(a), stats.total)} %',
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        _ProgressBar(value: stats.total == 0 ? 0 : stats.actionTotal(a) / stats.total, color: _actionColor(a)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildChart(ConsultationStats stats) {
    final chart = _ChartData.from(stats);
    return _Card(
      title: 'Évolution par ${chart.granularity}',
      icon: CupertinoIcons.chart_bar,
      subtitle: 'Touchez une colonne pour le détail',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (chart.items.isEmpty)
            const Text('Aucune donnée disponible pour cette période.', style: TextStyle(color: AppColors.textMuted))
          else
            _StackedColumns(chart: chart, sources: stats.sources),
          const SizedBox(height: 10),
          _SourceLegend(sources: stats.sources),
        ],
      ),
    );
  }

  Widget _buildSources(ConsultationStats stats) {
    return _Card(
      title: 'Détail par source',
      icon: CupertinoIcons.square_grid_2x2,
      subtitle: '${formatNumber(stats.total)} ${plural(stats.total, 'consultation')}',
      child: Column(
        children: [
          for (final (i, s) in stats.bySource.indexed) ...[
            if (i > 0) const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider(height: 1)),
            Row(
              children: [
                _Dot(color: sourceColor(s.code), size: 10),
                const SizedBox(width: 8),
                Expanded(child: Text(s.label, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700))),
                Text(formatNumber(s.total), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(width: 6),
                Text('(${_percent(s.total, stats.total)} %)', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              ],
            ),
            const SizedBox(height: 8),
            _ProgressBar(value: stats.total == 0 ? 0 : s.total / stats.total, color: sourceColor(s.code)),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final a in ConsultationAction.values)
                  Expanded(
                    child: _MiniStat(
                      label: a.shortLabel,
                      value: s.of(a),
                      percent: _percent(s.of(a), s.total),
                      color: _actionColor(a),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTop(ConsultationStats stats) {
    return Column(
      children: [
        for (final s in stats.sources)
          _Card(
            title: 'Top fiches — ${s.label}',
            icon: CupertinoIcons.list_number,
            subtitle: 'Les 10 fiches les plus consultées',
            child: () {
              final items = stats.top[s.code] ?? const <TopResource>[];
              if (items.isEmpty) {
                return const Text('Aucune fiche consultée sur cette période.', style: TextStyle(color: AppColors.textMuted));
              }
              final max = items.map((e) => e.consultations).fold(1, (a, b) => a > b ? a : b);
              return Column(
                children: [
                  for (final (i, item) in items.indexed)
                    InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => _openResource(s.code, item.id),
                      onLongPress: () => _filterJournalByResource(item.id),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            Container(
                              width: 26,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: sourceColor(s.code).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text('${i + 1}',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: sourceColor(s.code))),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(item.id,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary)),
                                      ),
                                      Text(formatNumber(item.consultations), style: const TextStyle(fontWeight: FontWeight.w700)),
                                    ],
                                  ),
                                  const SizedBox(height: 5),
                                  _ProgressBar(value: item.consultations / max, color: sourceColor(s.code), height: 6),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Voir le journal de cette ressource',
                              visualDensity: VisualDensity.compact,
                              onPressed: () => _filterJournalByResource(item.id),
                              icon: const Icon(CupertinoIcons.list_bullet, size: 18, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              );
            }(),
          ),
      ],
    );
  }

  // ---------- Journal ----------

  Widget _buildJournal() {
    return _Card(
      title: 'Journal des consultations',
      icon: CupertinoIcons.list_bullet,
      subtitle: _journalLoading ? 'Chargement…' : '${formatNumber(_journalCount)} ${plural(_journalCount, 'consultation')}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(label: const Text('Tous'), selected: _journalAction == null, onSelected: (_) => _setJournalAction(null)),
              for (final a in ConsultationAction.values)
                ChoiceChip(
                  label: Text(a.shortLabel),
                  selected: _journalAction == a,
                  onSelected: (_) => _setJournalAction(a),
                ),
            ],
          ),
          const SizedBox(height: 10),
          SearchField(
            controller: _resourceSearch,
            hint: 'Identifiant de ressource (13, W651…, hal-…)',
            onSubmitted: (v) {
              setState(() => _journalResource = v.trim());
              _reloadJournal();
            },
            onClear: () {
              setState(() => _journalResource = '');
              _reloadJournal();
            },
          ),
          const SizedBox(height: 8),
          if (_journalLoading)
            ...List.generate(4, (_) => const Padding(padding: EdgeInsets.only(top: 10), child: Skeleton(height: 48, radius: 10)))
          else if (_journalError != null)
            StatusView.error(message: _journalError, onAction: _reloadJournal, compact: true)
          else if (_entries.isEmpty)
            const StatusView(
              icon: CupertinoIcons.eye_slash,
              title: 'Aucune consultation trouvée',
              message: 'Essayez une autre période, une autre source ou un autre type.',
              compact: true,
            )
          else ...[
            for (final (i, e) in _entries.indexed) ...[
              if (i > 0) const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                onTap: e.resourceId == null ? null : () => _openResource(e.source, e.resourceId!),
                leading: Semantics(
                  label: e.actionLabel,
                  child: IconTile(_actionIcon(e.action), color: _actionColor(e.action), size: 38, iconSize: 18),
                ),
                title: Text(
                  e.resourceId ?? e.actionLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${e.actionLabel}\n${_formatDateTime(e.date)} · '
                  '${e.userId != null ? 'Utilisateur #${e.userId}' : 'Visiteur non connecté'}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                isThreeLine: true,
                trailing: _SourceBadge(code: e.source, label: e.sourceLabel),
              ),
            ],
            if (_journalHasNext) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _journalLoadingMore ? null : () => _loadJournal(_cancel ?? CancelToken(), more: true),
                icon: _journalLoadingMore
                    ? const CupertinoActivityIndicator()
                    : const Icon(CupertinoIcons.arrow_down_circle, size: 18),
                label: Text('Afficher plus (${_entries.length} / ${formatNumber(_journalCount)})'),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

// =================== Données du graphique ===================

class _ChartColumn {
  _ChartColumn(this.label, this.title, this.values, this.total);

  final String label;
  final String title;
  final Map<String, int> values;
  int total;
}

class _ChartData {
  _ChartData(this.granularity, this.items);

  final String granularity;
  final List<_ChartColumn> items;

  int get max => items.fold(1, (m, c) => c.total > m ? c.total : m);

  /// Regroupe par semaine ou par mois quand l'intervalle est trop long.
  factory _ChartData.from(ConsultationStats stats) {
    final days = stats.daily;
    final codes = stats.sources.map((s) => s.code).toList();
    if (days.length <= 62) {
      return _ChartData('jour', [
        for (final d in days)
          _ChartColumn(
            _fmt(d.date, 'd MMM'),
            _fmt(d.date, 'EEEE d MMMM y'),
            Map.of(d.bySource),
            d.total,
          ),
      ]);
    }
    final byMonth = days.length > 366;
    final grouped = <String, _ChartColumn>{};
    for (final d in days) {
      final date = parseDate(d.date);
      if (date == null) continue;
      final String key;
      final String label;
      final String title;
      if (byMonth) {
        key = DateFormat('yyyy-MM').format(date);
        label = DateFormat('MMM yy', 'fr_FR').format(date);
        title = DateFormat('MMMM y', 'fr_FR').format(date);
      } else {
        final monday = date.subtract(Duration(days: date.weekday - 1));
        key = formatInputDate(monday);
        label = DateFormat('d MMM', 'fr_FR').format(monday);
        title = 'Semaine du ${DateFormat('d MMMM y', 'fr_FR').format(monday)}';
      }
      final col = grouped.putIfAbsent(key, () => _ChartColumn(label, title, {for (final c in codes) c: 0}, 0));
      for (final c in codes) {
        col.values[c] = (col.values[c] ?? 0) + (d.bySource[c] ?? 0);
      }
      col.total += d.total;
    }
    return _ChartData(byMonth ? 'mois' : 'semaine', grouped.values.toList());
  }

  static String _fmt(String value, String pattern) {
    final date = parseDate(value);
    return date == null ? value : DateFormat(pattern, 'fr_FR').format(date);
  }
}

// =================== Widgets ===================

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
  const _Kpi({required this.icon, required this.label, required this.value, this.caption, this.color = AppColors.navy});

  final IconData icon;
  final String label;
  final String value;
  final String? caption;
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
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textPrimary)),
              if (caption != null)
                Text(caption!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
            ],
          ),
        ],
      ),
    );
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({required this.summary, required this.sources, required this.selected, required this.onTap});

  final PeriodSummary summary;
  final List<String> sources;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      onTap: onTap,
      borderColor: selected ? AppColors.primary : AppColors.border,
      color: selected ? AppColors.primarySoft : AppColors.surface,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(summary.label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
          Text(_formatRange(summary.dateDebut, summary.dateFin),
              maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(formatNumber(summary.total),
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: AppColors.textPrimary)),
          const SizedBox(height: 6),
          _StackBar(values: {for (final c in sources) c: summary.bySource[c] ?? 0}, total: summary.total),
          const Spacer(),
          for (final c in sources)
            Row(
              children: [
                _Dot(color: sourceColor(c), size: 7),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(ConsultationSource.labelOf(c),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ),
                Text(formatNumber(summary.bySource[c] ?? 0), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              ],
            ),
        ],
      ),
    );
  }
}

class _DiagnosticBanner extends StatelessWidget {
  const _DiagnosticBanner({required this.diagnostic});

  final ConsultationDiagnostic diagnostic;

  @override
  Widget build(BuildContext context) {
    final ok = diagnostic.ok;
    final color = ok ? AppColors.successDark : AppColors.danger;
    final last = diagnostic.dernierEnregistrement;
    return SurfaceCard(
      margin: const EdgeInsets.only(bottom: 14),
      color: color.withValues(alpha: 0.06),
      borderColor: color.withValues(alpha: 0.25),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(ok ? CupertinoIcons.checkmark_shield_fill : CupertinoIcons.exclamationmark_triangle_fill, color: color, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ok ? 'Enregistrement des consultations opérationnel' : "Problème d'enregistrement des consultations",
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 3),
                Text(
                  'Suivi ${diagnostic.middlewareActif ? 'actif' : 'inactif'} · '
                  'écriture ${diagnostic.ecriturePossible ? 'possible' : 'impossible'}'
                  '${diagnostic.erreurEcriture != null ? ' (${diagnostic.erreurEcriture})' : ''}\n'
                  'Dernier enregistrement : ${last == null ? '—' : _formatDateTime(last)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StackedColumns extends StatelessWidget {
  const _StackedColumns({required this.chart, required this.sources});

  static const _height = 170.0;

  final _ChartData chart;
  final List<ConsultationSource> sources;

  @override
  Widget build(BuildContext context) {
    final max = chart.max;
    return LayoutBuilder(builder: (context, constraints) {
      const axis = 34.0;
      final available = constraints.maxWidth - axis;
      final colWidth = (available / chart.items.length).clamp(22.0, 48.0);
      final scrollable = colWidth * chart.items.length > available;
      final columns = Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final col in chart.items)
            SizedBox(
              width: scrollable ? colWidth : available / chart.items.length,
              child: Tooltip(
                triggerMode: TooltipTriggerMode.tap,
                showDuration: const Duration(seconds: 4),
                message: '${col.title}\n'
                    '${sources.map((s) => '${s.label} : ${formatNumber(col.values[s.code] ?? 0)}').join('\n')}\n'
                    'Total : ${formatNumber(col.total)}',
                child: Column(
                  children: [
                    SizedBox(
                      height: _height,
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: Container(
                          width: 18,
                          height: col.total == 0 ? 2 : (_height * col.total / max).clamp(3.0, _height),
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            color: col.total == 0 ? AppColors.border : null,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                          ),
                          child: col.total == 0
                              ? null
                              : Column(
                                  verticalDirection: VerticalDirection.up,
                                  children: [
                                    for (final s in sources)
                                      if ((col.values[s.code] ?? 0) > 0)
                                        Expanded(flex: col.values[s.code]!, child: Container(color: sourceColor(s.code))),
                                  ],
                                ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(col.label,
                        maxLines: 1,
                        overflow: TextOverflow.clip,
                        style: const TextStyle(fontSize: 9.5, color: AppColors.textMuted)),
                  ],
                ),
              ),
            ),
        ],
      );
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: axis,
            height: _height,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final v in [max, (max / 2).round(), 0])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Text(formatNumber(v), style: const TextStyle(fontSize: 10, color: AppColors.textFaint)),
                  ),
              ],
            ),
          ),
          Expanded(
            child: scrollable
                ? SingleChildScrollView(scrollDirection: Axis.horizontal, reverse: true, child: columns)
                : columns,
          ),
        ],
      );
    });
  }
}

class _StackBar extends StatelessWidget {
  const _StackBar({required this.values, required this.total});

  final Map<String, int> values;
  final int total;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: 6,
        child: total == 0
            ? Container(color: AppColors.fill)
            : Row(
                children: [
                  for (final e in values.entries)
                    if (e.value > 0) Expanded(flex: e.value, child: Container(color: sourceColor(e.key))),
                ],
              ),
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.value, required this.color, this.height = 8});

  final double value;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1).toDouble(),
        minHeight: height,
        color: color,
        backgroundColor: AppColors.fill,
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value, required this.percent, required this.color});

  final String label;
  final int value;
  final double percent;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _Dot(color: color, size: 6),
            const SizedBox(width: 4),
            Flexible(
              child: Text(label,
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
            ),
          ],
        ),
        Text(formatNumber(value), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        Text('$percent %', style: const TextStyle(fontSize: 10.5, color: AppColors.textFaint)),
      ],
    );
  }
}

class _SourceLegend extends StatelessWidget {
  const _SourceLegend({required this.sources});

  final List<ConsultationSource> sources;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 16,
      runSpacing: 6,
      children: [
        for (final s in sources)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: sourceColor(s.code), borderRadius: BorderRadius.circular(3))),
              const SizedBox(width: 6),
              Text(s.label, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
            ],
          ),
      ],
    );
  }
}

class _SourceBadge extends StatelessWidget {
  const _SourceBadge({required this.code, required this.label});

  final String code;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = sourceColor(code);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, this.size = 9});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
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
