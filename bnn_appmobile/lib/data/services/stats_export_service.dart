import 'dart:io';

import 'package:excel/excel.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import '../../core/utils/formatters.dart';
import '../models/action_stats.dart';

/// Données d'un rapport statistique prêt à exporter.
class StatsReport {
  const StatsReport({
    required this.dateDebut,
    required this.dateFin,
    required this.rows,
    required this.filtersLabel,
  });

  final String dateDebut;
  final String dateFin;
  final List<ActionRow> rows;
  final String filtersLabel;

  int get insertions => rows.where((r) => r.type == ActionType.insertion).fold(0, (s, r) => s + r.count);
  int get modifications => rows.where((r) => r.type == ActionType.modification).fold(0, (s, r) => s + r.count);
  int get total => insertions + modifications;
  int get activeUsers => rows.map((r) => r.userKey).toSet().length;
  List<UserTotal> get users => ActionStatsParser.userTotals(rows);

  String get periodLabel => 'Période : ${formatShortDate(dateDebut)} - ${formatShortDate(dateFin)}';
  String get fileBase => 'rapport-statistique-$dateDebut-$dateFin';
}

/// Génération des rapports PDF et Excel (miroir des exports BNN Web).
class StatsExportService {
  static const institutionHeader = [
    'REPUBLIQUE DEMOCRATIQUE DU CONGO',
    "MINISTERE DE L'ESURSI",
    'BIBLIOTHEQUE NUMERIQUE NATIONALE',
  ];

  static const _navy = PdfColor.fromInt(0xFF073B70);

  static String _n(num value) => formatNumber(value).replaceAll(RegExp(r'[  ]'), ' ');

  static String _generatedAt() {
    final now = DateTime.now();
    return 'Généré le ${formatLongDate(formatInputDate(now))} à ${formatTime(now.toIso8601String())}';
  }

  Future<Uint8List> buildPdf(StatsReport report) async {
    final logo = pw.MemoryImage((await rootBundle.load('assets/images/logo_bnn_report.png')).buffer.asUint8List());
    final doc = pw.Document(title: 'Rapport statistique des actions', author: 'Bibliothèque Numérique Nationale');
    final headStyle = pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 9);
    final cellStyle = const pw.TextStyle(fontSize: 8.5);
    final generated = _generatedAt();

    pw.Widget table(List<String> headers, List<List<String>> data, {Map<int, pw.TableColumnWidth>? widths}) =>
        pw.TableHelper.fromTextArray(
          headers: headers,
          data: data,
          headerStyle: headStyle,
          headerDecoration: const pw.BoxDecoration(color: _navy),
          cellStyle: cellStyle,
          oddRowDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF1F5F9)),
          cellPadding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 4),
          columnWidths: widths,
          border: null,
        );

    pw.Widget title(String text) => pw.Padding(
          padding: const pw.EdgeInsets.only(top: 14, bottom: 6),
          child: pw.Text(text, style: pw.TextStyle(color: _navy, fontWeight: pw.FontWeight.bold, fontSize: 12)),
        );

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.fromLTRB(36, 28, 36, 28),
        header: (context) => pw.Container(
          padding: const pw.EdgeInsets.only(bottom: 8),
          margin: const pw.EdgeInsets.only(bottom: 10),
          decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _navy, width: 1.2))),
          child: pw.Row(
            children: [
              pw.Image(logo, height: 44),
              pw.Expanded(
                child: pw.Column(
                  children: [
                    for (final line in institutionHeader)
                      pw.Text(line, style: pw.TextStyle(color: _navy, fontWeight: pw.FontWeight.bold, fontSize: 10.5)),
                  ],
                ),
              ),
              pw.SizedBox(width: 90),
            ],
          ),
        ),
        footer: (context) => pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.Text(
            'Bibliothèque Numérique Nationale - Page ${context.pageNumber}/${context.pagesCount}',
            style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
          ),
        ),
        build: (context) => [
          pw.Center(
            child: pw.Text('RAPPORT STATISTIQUE DES ACTIONS',
                style: pw.TextStyle(color: _navy, fontWeight: pw.FontWeight.bold, fontSize: 16)),
          ),
          pw.SizedBox(height: 4),
          pw.Center(child: pw.Text(report.periodLabel, style: const pw.TextStyle(fontSize: 10))),
          pw.Center(child: pw.Text(generated, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700))),
          title('SYNTHÈSE'),
          pw.SizedBox(
            width: 260,
            child: table(['Indicateur', 'Total'], [
              ['Ajouts', _n(report.insertions)],
              ['Modifications', _n(report.modifications)],
              ['Actions analysées', _n(report.total)],
              ['Utilisateurs actifs', _n(report.activeUsers)],
            ]),
          ),
          title('TOTAUX PAR UTILISATEUR'),
          table(
            ['Utilisateur', 'Ajouts', 'Modifications', 'Total actions'],
            [for (final u in report.users) [u.label, _n(u.insertions), _n(u.modifications), _n(u.total)]],
          ),
          title('JOURNAL DÉTAILLÉ DES AJOUTS ET MODIFICATIONS'),
          pw.Text('Filtres : ${report.filtersLabel}', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
          pw.SizedBox(height: 6),
          table(
            ['Action', 'Utilisateur', 'Nombre', 'Date', 'Heure', 'Ressource(s)'],
            [
              for (final r in report.rows)
                [r.type.label, r.userLabel, _n(r.count), formatShortDate(r.date), formatTime(r.time), r.resourcesLabel],
            ],
            widths: const {5: pw.FlexColumnWidth(3)},
          ),
        ],
      ),
    );
    return doc.save();
  }

  Uint8List buildExcel(StatsReport report) {
    final excel = Excel.createExcel();
    final defaultSheet = excel.getDefaultSheet();
    final bold = CellStyle(bold: true, fontColorHex: ExcelColor.fromHexString('#073B70'));
    final header = CellStyle(
      bold: true,
      fontColorHex: ExcelColor.white,
      backgroundColorHex: ExcelColor.fromHexString('#073B70'),
    );

    void preamble(Sheet sheet, String heading) {
      for (final line in institutionHeader) {
        sheet.appendRow([TextCellValue(line)]);
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: sheet.maxRows - 1)).cellStyle = bold;
      }
      sheet.appendRow([TextCellValue('')]);
      sheet.appendRow([TextCellValue(heading)]);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: sheet.maxRows - 1)).cellStyle = bold;
      sheet.appendRow([TextCellValue(report.periodLabel)]);
      sheet.appendRow([TextCellValue(_generatedAt())]);
      sheet.appendRow([TextCellValue('')]);
    }

    void headerRow(Sheet sheet, List<String> labels) {
      sheet.appendRow(labels.map(TextCellValue.new).toList());
      final row = sheet.maxRows - 1;
      for (var i = 0; i < labels.length; i++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: row)).cellStyle = header;
      }
    }

    final summary = excel['Synthèse'];
    preamble(summary, 'RAPPORT STATISTIQUE DES ACTIONS');
    headerRow(summary, ['Indicateur', 'Total']);
    for (final (label, value) in [
      ('Ajouts', report.insertions),
      ('Modifications', report.modifications),
      ('Actions analysées', report.total),
      ('Utilisateurs actifs', report.activeUsers),
    ]) {
      summary.appendRow([TextCellValue(label), IntCellValue(value)]);
    }
    summary.appendRow([TextCellValue('')]);
    summary.appendRow([TextCellValue('TOTAUX PAR UTILISATEUR')]);
    headerRow(summary, ['Utilisateur', 'Ajouts', 'Modifications', 'Total actions']);
    for (final u in report.users) {
      summary.appendRow([TextCellValue(u.label), IntCellValue(u.insertions), IntCellValue(u.modifications), IntCellValue(u.total)]);
    }
    summary.setColumnWidth(0, 34);
    for (var i = 1; i < 4; i++) {
      summary.setColumnWidth(i, 16);
    }

    final details = excel['Détail'];
    preamble(details, 'JOURNAL DÉTAILLÉ DES AJOUTS ET MODIFICATIONS');
    details.appendRow([TextCellValue('Filtres appliqués : ${report.filtersLabel}')]);
    headerRow(details, ['Action', 'Utilisateur', 'Nombre', 'Date', 'Heure', 'Ressource(s)']);
    for (final r in report.rows) {
      details.appendRow([
        TextCellValue(r.type.label),
        TextCellValue(r.userLabel),
        IntCellValue(r.count),
        TextCellValue(formatShortDate(r.date)),
        TextCellValue(formatTime(r.time)),
        TextCellValue(r.resourcesLabel),
      ]);
    }
    for (final (i, width) in [(0, 16.0), (1, 30.0), (2, 10.0), (3, 16.0), (4, 10.0), (5, 60.0)]) {
      details.setColumnWidth(i, width);
    }

    if (defaultSheet != null && defaultSheet != 'Synthèse' && defaultSheet != 'Détail') {
      excel.delete(defaultSheet);
    }
    excel.setDefaultSheet('Synthèse');
    final bytes = excel.encode();
    if (bytes == null) throw StateError('Le fichier Excel n’a pas pu être généré.');
    return Uint8List.fromList(bytes);
  }

  /// Enregistre le fichier dans un dossier temporaire puis ouvre le partage système.
  Future<void> share(Uint8List bytes, String fileName, String mimeType) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path, mimeType: mimeType)], subject: 'Rapport statistique BNN'),
    );
  }
}
