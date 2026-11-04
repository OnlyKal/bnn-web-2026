import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/openalex.dart';
import '../../../state/history_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/external_links.dart';
import '../../widgets/states.dart';
import '../home/openalex_view.dart';
import '../viewers/pdf_viewer_screen.dart';

/// Fiche détaillée d'une publication OpenAlex, avec lecture du PDF dans le lecteur intégré.
class OpenAlexDetailsScreen extends StatefulWidget {
  const OpenAlexDetailsScreen({super.key, required this.workId, this.initial});

  final String workId;

  /// Notice issue de la liste, affichée immédiatement pendant le chargement complet.
  final OpenAlexWork? initial;

  @override
  State<OpenAlexDetailsScreen> createState() => _OpenAlexDetailsScreenState();
}

class _OpenAlexDetailsScreenState extends State<OpenAlexDetailsScreen> {
  OpenAlexWork? _work;
  OpenAlexPdfInfo? _pdfInfo;
  bool _loading = false;
  bool _pdfInfoLoading = true;
  String? _error;
  bool _abstractExpanded = false;
  bool _logged = false;

  @override
  void initState() {
    super.initState();
    _work = widget.initial;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final service = context.read<AppServices>().openAlex;
    setState(() {
      _loading = _work == null;
      _error = null;
      _pdfInfoLoading = true;
    });
    // Notice complète et mode d'accès au PDF, chargés en parallèle.
    final pdfInfo = service.pdfInfo(widget.workId).then<OpenAlexPdfInfo?>((v) => v).catchError((_) => null);
    try {
      final work = await service.work(widget.workId);
      if (!mounted) return;
      setState(() => _work = work);
      _logVisit(work);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (_work == null) setState(() => _error = e.message);
      if (_work != null) _logVisit(_work!);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    final info = await pdfInfo;
    if (!mounted) return;
    setState(() {
      _pdfInfo = info ?? (_work == null ? null : _fallbackAccess(_work!));
      _pdfInfoLoading = false;
    });
  }

  /// Repli si `/pdf-info/` ne répond pas : on déduit l'accès des champs de la notice.
  OpenAlexPdfInfo _fallbackAccess(OpenAlexWork work) {
    final access = work.pdfAvailable && work.pdfUrl != null
        ? OpenAlexAccess.openAlexProxy
        : work.externalPdfUrl != null
            ? OpenAlexAccess.externalLink
            : work.landingPageUrl != null
                ? OpenAlexAccess.landingPage
                : OpenAlexAccess.unavailable;
    return OpenAlexPdfInfo(
      access: access,
      pdfUrl: work.pdfUrl,
      externalPdfUrl: work.externalPdfUrl,
      landingPageUrl: work.landingPageUrl,
      license: work.license,
    );
  }

  void _logVisit(OpenAlexWork work) {
    if (_logged) return;
    _logged = true;
    context.read<HistoryController>().add(
          type: HistoryType.resource,
          title: work.title,
          description: 'Publication OpenAlex consultée · ${work.typeLabel}',
          target: HistoryTarget.openAlex,
          metadata: {'workId': work.id, 'externalSource': 'OpenAlex'},
        );
  }

  Future<void> _readPdf(OpenAlexPdfInfo info) async {
    final work = _work!;
    final url = info.pdfUrl;
    if (url == null) return;
    await Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => PdfViewerScreen(
        url: url,
        title: work.title,
        browserUrl: info.landingPageUrl ?? info.externalPdfUrl,
        loadingLabel: info.cachedOnServer
            ? 'Chargement du document…'
            : 'Préparation du PDF… le premier affichage peut prendre quelques secondes.',
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final w = _work;
    if (w == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Publication')),
        body: _loading
            ? const Center(child: CupertinoActivityIndicator())
            : StatusView(
                icon: CupertinoIcons.exclamationmark_circle,
                isError: true,
                title: 'Publication introuvable',
                message: _error,
                actionLabel: 'Réessayer',
                onAction: _load,
              ),
      );
    }

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 250,
            backgroundColor: AppColors.surface,
            actions: [
              if (w.openAlexUrl != null)
                IconButton(
                  tooltip: 'Voir sur OpenAlex',
                  onPressed: () => openExternalUrl(context, w.openAlexUrl),
                  icon: const Icon(CupertinoIcons.arrow_up_right_square),
                ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              collapseMode: CollapseMode.pin,
              background: Container(
                color: AppColors.primarySoft,
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 56, 24, 22),
                    child: Center(
                      child: AspectRatio(
                        aspectRatio: 0.72,
                        child: LayoutBuilder(
                          builder: (context, c) => Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.primaryTint),
                            ),
                            child: OpenAlexCover(
                              type: w.type,
                              width: c.maxWidth - 8,
                              height: c.maxHeight - 8,
                              radius: 9,
                              pdf: w.pdfAvailable,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 36),
            sliver: SliverList.list(
              children: [
                Row(
                  children: [
                    Icon(openAlexTypeIcon(w.type), size: 15, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      w.typeLabel.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.7,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SelectableText(
                  w.title,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, height: 1.25, letterSpacing: -0.4),
                ),
                if (w.authors.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 2),
                        child: Icon(CupertinoIcons.person, size: 15, color: AppColors.textMuted),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          w.authorsLabel,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 14),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    const Pill('OpenAlex', color: AppColors.navy, filled: true),
                    Pill(w.typeLabel),
                    if (w.pdfAvailable) const Pill('PDF', color: AppColors.pdf),
                    if (w.openAccess == true) const Pill('Libre accès', color: AppColors.successDark),
                    if (w.languageLabel.isNotEmpty) Pill(w.languageLabel, color: AppColors.navy),
                    if (w.year != null) Pill('${w.year}', color: AppColors.textMuted),
                  ],
                ),
                if (w.isRetracted) ...[
                  const SizedBox(height: 16),
                  const _Notice(
                    icon: CupertinoIcons.exclamationmark_triangle,
                    color: AppColors.danger,
                    title: 'Publication rétractée',
                    message: 'Cette publication a été retirée par son éditeur. Consultez-la avec prudence.',
                  ),
                ],
                const SizedBox(height: 28),
                const _SectionTitle('Accès au document', icon: CupertinoIcons.doc_on_doc),
                _AccessCard(
                  loading: _pdfInfoLoading,
                  info: _pdfInfo,
                  onRead: _readPdf,
                ),
                if (w.abstract != null) ...[
                  const SizedBox(height: 28),
                  const _SectionTitle('Résumé', icon: CupertinoIcons.text_alignleft),
                  SurfaceCard(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AnimatedSize(
                          duration: const Duration(milliseconds: 220),
                          alignment: Alignment.topCenter,
                          child: Text(
                            w.abstract!,
                            maxLines: _abstractExpanded ? null : 6,
                            overflow: _abstractExpanded ? null : TextOverflow.fade,
                            style: const TextStyle(color: AppColors.textSecondary, height: 1.6, fontSize: 14.5),
                          ),
                        ),
                        if (w.abstract!.length > 320)
                          TextButton.icon(
                            style: TextButton.styleFrom(padding: EdgeInsets.zero),
                            onPressed: () => setState(() => _abstractExpanded = !_abstractExpanded),
                            icon: Icon(_abstractExpanded ? CupertinoIcons.chevron_up : CupertinoIcons.chevron_down, size: 14),
                            label: Text(_abstractExpanded ? 'Réduire' : 'Lire la suite'),
                          )
                        else
                          const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(color: AppColors.fill, borderRadius: BorderRadius.circular(12)),
                  child: const Row(
                    children: [
                      Icon(CupertinoIcons.eye, size: 17, color: AppColors.textMuted),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Cette plateforme est dédiée à la consultation uniquement.',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                _SectionTitle('Informations détaillées', icon: CupertinoIcons.info_circle, trailing: w.id),
                _InfoCard(work: w),
                if (w.openAlexUrl != null) ...[
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: () => openExternalUrl(context, w.openAlexUrl),
                    icon: const Icon(CupertinoIcons.arrow_up_right_square, size: 19),
                    label: const Text('Consulter la notice sur OpenAlex'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Bouton d'accès adapté à `download_method` : lecteur intégré, PDF éditeur,
/// page de la publication, ou document indisponible.
class _AccessCard extends StatelessWidget {
  const _AccessCard({required this.loading, required this.info, required this.onRead});

  final bool loading;
  final OpenAlexPdfInfo? info;
  final ValueChanged<OpenAlexPdfInfo> onRead;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SurfaceCard(
        child: Row(
          children: [
            CupertinoActivityIndicator(),
            SizedBox(width: 12),
            Text('Vérification document…', style: TextStyle(color: AppColors.textMuted)),
          ],
        ),
      );
    }
    final i = info;
    final (icon, color, title, subtitle, label, actionIcon, VoidCallback? action) = switch (i?.access) {
      OpenAlexAccess.openAlexProxy when i?.pdfUrl != null => (
          CupertinoIcons.doc_text_fill,
          AppColors.pdf,
          'Document PDF',
          i!.cachedOnServer
              ? 'Disponible dans le lecteur intégré'
              : 'Lecteur intégré · le premier affichage prend quelques secondes',
          'Lire',
          CupertinoIcons.book_fill,
          () => onRead(i),
        ),
      OpenAlexAccess.externalLink when i?.externalPdfUrl != null => (
          CupertinoIcons.doc_text,
          AppColors.navy,
          'PDF chez l’éditeur',
          'Ouverture dans le navigateur (site externe)',
          'Ouvrir',
          CupertinoIcons.arrow_up_right_square,
          () => openExternalUrl(context, i!.externalPdfUrl),
        ),
      OpenAlexAccess.landingPage when i?.landingPageUrl != null => (
          CupertinoIcons.globe,
          AppColors.navy,
          'Page de la publication',
          'Consultable sur le site de l’éditeur',
          'Voir',
          CupertinoIcons.arrow_up_right_square,
          () => openExternalUrl(context, i!.landingPageUrl),
        ),
      _ => (
          CupertinoIcons.doc,
          AppColors.textMuted,
          'Document non disponible',
          'Aucun accès en ligne n’est connu pour cette publication.',
          '',
          CupertinoIcons.xmark,
          null,
        ),
    };
    return SurfaceCard(
      onTap: action,
      child: Row(
        children: [
          IconTile(icon, color: color, size: 46, iconSize: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                const SizedBox(height: 3),
                Text(subtitle, style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5, height: 1.35)),
                if (i?.license != null) ...[
                  const SizedBox(height: 6),
                  Pill('Licence : ${i!.license}', color: AppColors.textMuted),
                ],
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: 8),
            FilledButton.icon(
              style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 14)),
              onPressed: action,
              icon: Icon(actionIcon, size: 16),
              label: Text(label),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.work});

  final OpenAlexWork work;

  @override
  Widget build(BuildContext context) {
    final w = work;
    final b = w.biblio;
    final pages = [b['first_page'], b['last_page']].where((e) => e != null && '$e'.isNotEmpty).join('–');
    final biblio = [
      if (b['volume'] != null) 'Vol. ${b['volume']}',
      if (b['issue'] != null) 'n° ${b['issue']}',
      if (pages.isNotEmpty) 'p. $pages',
    ].join(', ');
    final institutions = {for (final a in w.authors) ...a.institutions}.toList();
    final rows = <(IconData, String, String, String?)>[
      if (w.authors.isNotEmpty) (CupertinoIcons.person, 'Auteur(s)', w.authorsLabel, null),
      if (institutions.isNotEmpty) (CupertinoIcons.building_2_fill, 'Institution(s)', institutions.join(', '), null),
      if (w.sourceName != null) (CupertinoIcons.book, 'Source', w.sourceName!, biblio.isEmpty ? null : biblio),
      if (w.publisher != null) (CupertinoIcons.briefcase, 'Éditeur', w.publisher!, null),
      if (w.categoryLabel != null) (CupertinoIcons.folder, 'Classement', w.categoryLabel!, w.topic),
      if (w.keywords.isNotEmpty) (CupertinoIcons.tag, 'Mots-clés', w.keywords.join(', '), null),
      (CupertinoIcons.doc_text, 'Type de document', w.typeLabel, null),
      if (w.languageLabel.isNotEmpty) (CupertinoIcons.textformat, 'Langue', w.languageLabel, null),
      if (w.date != null || w.year != null)
        (
          CupertinoIcons.calendar,
          'Publication',
          w.date != null ? formatLongDate(w.date, fallback: '${w.year ?? ''}') : '${w.year}',
          null,
        ),
      if (w.doi != null) (CupertinoIcons.link, 'DOI', w.doi!, null),
      (CupertinoIcons.quote_bubble, 'Citations', formatNumber(w.citedByCount), null),
      if (w.openAccess != null)
        (
          CupertinoIcons.lock_open,
          'Libre accès',
          w.openAccess! ? 'Oui' : 'Non',
          w.oaStatus == null ? null : openAlexOaStatusLabel(w.oaStatus),
        ),
      if (w.license != null) (CupertinoIcons.checkmark_shield, 'Licence', w.license!, null),
    ];
    return GroupedSection(
      children: [
        for (final (icon, label, value, extra) in rows)
          InfoRow(icon: icon, label: label, value: value, extra: extra, selectable: true),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {this.trailing, this.icon});

  final String text;
  final String? trailing;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SectionHeader(
        title: text,
        icon: icon,
        trailing: trailing == null ? null : Pill(trailing!, color: AppColors.textMuted),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.color, required this.title, required this.message});

  final IconData icon;
  final Color color;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: color)),
                const SizedBox(height: 2),
                Text(message, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
