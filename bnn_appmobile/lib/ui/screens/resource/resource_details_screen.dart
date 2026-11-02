import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/html_text.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/ressource.dart';
import '../../../state/favorites_controller.dart';
import '../../../state/history_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/external_links.dart';
import '../../widgets/feedback.dart';
import '../../widgets/resource_card.dart';
import '../../widgets/states.dart';
import '../viewers/viewer_launcher.dart';

class ResourceDetailsScreen extends StatefulWidget {
  const ResourceDetailsScreen({super.key, this.initial, this.resourceId, this.historyDescription})
      : assert(initial != null || resourceId != null);

  final Ressource? initial;
  final String? resourceId;
  final String? historyDescription;

  @override
  State<ResourceDetailsScreen> createState() => _ResourceDetailsScreenState();
}

class _ResourceDetailsScreenState extends State<ResourceDetailsScreen> {
  Ressource? _ressource;
  bool _loading = false;
  String? _error;
  bool _descriptionExpanded = false;

  @override
  void initState() {
    super.initState();
    _ressource = widget.initial;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final services = context.read<AppServices>();
    final initial = widget.initial;
    if (initial != null) {
      _logVisit(initial);
      // Les notices HAL sont rafraîchies pour obtenir les données complètes.
      if (initial.isExternal) {
        try {
          final fresh = await services.hal.ouvrage(initial.externalId);
          if (mounted) setState(() => _ressource = fresh);
        } on ApiException {
          // La notice transmise reste affichée.
        }
      }
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final found = await services.ressources.findById(widget.resourceId!);
      if (!mounted) return;
      if (found == null) {
        setState(() => _error = 'Ressource non trouvée');
      } else {
        setState(() => _ressource = found);
        _logVisit(found);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _logVisit(Ressource r) {
    context.read<HistoryController>().addResource(
          r,
          description: widget.historyDescription ?? r.domaineNom ?? r.typeLabel,
        );
  }

  Future<void> _toggleFavorite() async {
    final r = _ressource!;
    final favorites = context.read<FavoritesController>();
    final history = context.read<HistoryController>();
    try {
      final added = await favorites.toggle(r);
      history.addResource(
        r,
        type: HistoryType.favorite,
        action: added ? 'added' : 'removed',
        description: added ? 'Ressource ajoutée aux favoris' : 'Ressource retirée des favoris',
      );
      if (mounted) showSuccess(context, added ? 'Ajouté aux favoris' : 'Retiré des favoris');
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    }
  }

  Future<void> _openFile(RessourceFichier fichier) async {
    final r = _ressource!;
    if (!r.isExternal) context.read<AppServices>().ressources.recordConsultation(r.id);
    await openFileViewer(context, ressource: r, fichier: fichier);
  }

  @override
  Widget build(BuildContext context) {
    final r = _ressource;
    if (r == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Ressource')),
        body: _loading
            ? const Center(child: CupertinoActivityIndicator())
            : StatusView(
                icon: CupertinoIcons.exclamationmark_circle,
                isError: true,
                title: 'Ressource non trouvée',
                message: _error,
                actionLabel: 'Réessayer',
                onAction: _load,
              ),
      );
    }

    final favorites = context.watch<FavoritesController>();
    final isFavorite = favorites.isFavorite(r);
    final pending = favorites.isPending(r);
    final description = htmlToPlainText(r.description);

    final typeLabel = r.isExternal ? (r.type ?? 'Publication') : r.typeLabel;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 280,
            backgroundColor: AppColors.surface,
            actions: [
              IconButton(
                tooltip: isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris',
                onPressed: pending ? null : _toggleFavorite,
                icon: pending
                    ? const CupertinoActivityIndicator()
                    : Icon(
                        isFavorite ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                        color: isFavorite ? AppColors.rose : AppColors.primary,
                      ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              collapseMode: CollapseMode.pin,
              background: _Header(ressource: r),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 36),
            sliver: SliverList.list(
              children: [
                Row(
                  children: [
                    Icon(typeIcon(r.type), size: 15, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        typeLabel.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.7,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  r.titre,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, height: 1.25, letterSpacing: -0.4),
                ),
                if (r.sousTitre != null) ...[
                  const SizedBox(height: 6),
                  Text(r.sousTitre!, style: const TextStyle(color: AppColors.textMuted, fontSize: 15, height: 1.4)),
                ],
                if (r.auteurs != null && r.auteurs!.isNotEmpty) ...[
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
                          r.auteurs!,
                          maxLines: 2,
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
                    if (r.isExternal) const Pill('HAL', color: AppColors.navy, filled: true),
                    Pill(typeLabel),
                    if (r.format != null) Pill(r.format!.toUpperCase(), color: formatVisual(r.format).$2),
                    if (r.langue != null && r.langue!.isNotEmpty) Pill(r.langueLabel, color: AppColors.navy),
                  ],
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  style: isFavorite
                      ? FilledButton.styleFrom(
                          backgroundColor: AppColors.primarySoft,
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primaryTint),
                        )
                      : null,
                  onPressed: pending ? null : _toggleFavorite,
                  icon: Icon(isFavorite ? CupertinoIcons.heart_fill : CupertinoIcons.heart, size: 20),
                  label: Text(isFavorite ? 'Dans vos favoris' : 'Ajouter aux favoris'),
                ),
                if (r.fichiers.isNotEmpty || r.isExternal) const SizedBox(height: 28),
                if (r.fichiers.isNotEmpty) ...[
                  _SectionTitle('Fichiers disponibles (${r.fichiers.length})', icon: CupertinoIcons.doc_on_doc),
                  for (final (index, f) in r.fichiers.indexed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _FileCard(
                        fichier: f,
                        fallbackTitle: r.titre.isNotEmpty ? r.titre : 'Fichier ${index + 1}',
                        fallbackFormat: r.format,
                        onOpen: () => _openFile(f),
                      ),
                    ),
                ] else if (r.isExternal)
                  _Notice(
                    icon: CupertinoIcons.doc_text,
                    title: 'Fichier PDF indisponible',
                    message: 'HAL ne fournit pas de lien direct vers le document pour cette ressource.',
                    action: r.sourceUrl == null
                        ? null
                        : TextButton.icon(
                            style: TextButton.styleFrom(padding: EdgeInsets.zero),
                            onPressed: () => openExternalUrl(context, r.sourceUrl),
                            icon: const Icon(CupertinoIcons.arrow_up_right_square, size: 17),
                            label: const Text('Consulter la notice sur HAL'),
                          ),
                  ),
                if (description.isNotEmpty) ...[
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
                            description,
                            maxLines: _descriptionExpanded ? null : 6,
                            overflow: _descriptionExpanded ? null : TextOverflow.fade,
                            style: const TextStyle(color: AppColors.textSecondary, height: 1.6, fontSize: 14.5),
                          ),
                        ),
                        if (description.length > 320)
                          TextButton.icon(
                            style: TextButton.styleFrom(padding: EdgeInsets.zero),
                            onPressed: () => setState(() => _descriptionExpanded = !_descriptionExpanded),
                            icon: Icon(_descriptionExpanded ? CupertinoIcons.chevron_up : CupertinoIcons.chevron_down, size: 14),
                            label: Text(_descriptionExpanded ? 'Réduire' : 'Lire la suite'),
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
                  decoration: BoxDecoration(
                    color: AppColors.fill,
                    borderRadius: BorderRadius.circular(12),
                  ),
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
                _SectionTitle(
                  'Informations détaillées',
                  icon: CupertinoIcons.info_circle,
                  trailing: r.isExternal ? null : '#${r.id}',
                ),
                _InfoCard(ressource: r),
                if (r.isExternal && r.sourceUrl != null) ...[
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: () => openExternalUrl(context, r.sourceUrl),
                    icon: const Icon(CupertinoIcons.arrow_up_right_square, size: 19),
                    label: const Text('Consulter la notice HAL'),
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

class _Header extends StatelessWidget {
  const _Header({required this.ressource});

  final Ressource ressource;

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  child: ResourceCover(
                    ressource: ressource,
                    width: c.maxWidth - 8,
                    height: c.maxHeight - 8,
                    radius: 9,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
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

class _FileCard extends StatelessWidget {
  const _FileCard({
    required this.fichier,
    required this.fallbackTitle,
    required this.fallbackFormat,
    required this.onOpen,
  });

  final RessourceFichier fichier;
  final String fallbackTitle;
  final String? fallbackFormat;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final format = fichier.format ?? fallbackFormat;
    final (icon, color) = formatVisual(format);
    final kind = fichier.readableKind(fallbackFormat);
    final isVideo = kind == ReadableKind.video;
    return SurfaceCard(
      onTap: fichier.url == null ? null : onOpen,
      child: Row(
        children: [
          IconTile(icon, color: color, size: 46, iconSize: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fichier.titre ?? fallbackTitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (format != null) Pill(format.toUpperCase(), color: color),
                    if (fichier.taille != null) Pill(fichier.taille!, color: AppColors.textMuted),
                    if (isVideo && fichier.duree != null) Pill('Durée : ${fichier.duree}', color: AppColors.textMuted),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: 14),
            ),
            onPressed: fichier.url == null ? null : onOpen,
            icon: Icon(isVideo ? CupertinoIcons.play_fill : CupertinoIcons.book_fill, size: 16),
            label: Text(isVideo ? 'Lire' : 'Ouvrir'),
          ),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.title, required this.message, this.action});

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primaryTint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
            ],
          ),
          const SizedBox(height: 6),
          Text(message, style: const TextStyle(color: AppColors.textSecondary, height: 1.4)),
          ?action,
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.ressource});

  final Ressource ressource;

  @override
  Widget build(BuildContext context) {
    final r = ressource;
    final publication = [
      if (r.edition != null) '${r.edition} édition',
      if (r.lieuEdition != null) 'Lieu : ${r.lieuEdition}',
    ].join(' · ');
    final rows = <(IconData, String, String, String?)>[
      if (r.auteurs != null && r.auteurs!.isNotEmpty) (CupertinoIcons.person, 'Auteur(s)', r.auteurs!, null),
      if (r.isExternal && r.keywords.isNotEmpty) (CupertinoIcons.tag, 'Mots-clés HAL', r.keywords.join(', '), null),
      (CupertinoIcons.folder, 'Domaine', r.domaineNom ?? 'Non spécifié', r.sousDomaineNom),
      (
        CupertinoIcons.doc_text,
        'Type & format',
        [r.isExternal ? r.type : r.typeLabel, r.format?.toUpperCase()].whereType<String>().join(' • '),
        null,
      ),
      if (r.langue != null && r.langue!.isNotEmpty) (CupertinoIcons.textformat, 'Langue', r.langueLabel, null),
      if (r.pays != null) (CupertinoIcons.location, 'Pays', r.pays!, null),
      if (publication.isNotEmpty) (CupertinoIcons.book, 'Publication', publication, null),
      if (r.datePublication != null)
        (
          CupertinoIcons.calendar,
          r.isExternal ? 'Année de publication' : 'Date de publication',
          r.isExternal ? r.datePublication! : formatLongDate(r.datePublication),
          null,
        ),
      if (r.isbn != null) (CupertinoIcons.barcode, 'ISBN', r.isbn!, null),
    ];

    return GroupedSection(
      children: [
        for (final (icon, label, value, extra) in rows)
          InfoRow(icon: icon, label: label, value: value, extra: extra, selectable: true),
      ],
    );
  }
}
