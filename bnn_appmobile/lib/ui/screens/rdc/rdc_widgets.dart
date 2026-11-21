import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/models/encyclopedie.dart';
import '../../../data/services/encyclopedie_service.dart';
import '../../widgets/common.dart';
import '../../widgets/states.dart';
import 'rdc_explorer_screen.dart';
import 'rdc_fiche_screen.dart';
import 'rdc_province_screen.dart';

EncyclopedieService rdcService(BuildContext context) => context.read<AppServices>().encyclopedie;

IconData rdcIcon(String? key) => switch (key) {
      'histoire' => Icons.account_balance_outlined,
      'geographie' => Icons.map_outlined,
      'transport' => Icons.train_outlined,
      'energie' => Icons.bolt_outlined,
      'nature' => Icons.park_outlined,
      'ressources' => Icons.diamond_outlined,
      'patrimoine' => Icons.theater_comedy_outlined,
      'personne' => CupertinoIcons.person,
      'evenement' => CupertinoIcons.calendar,
      _ => CupertinoIcons.book,
    };

final _numberFormat = NumberFormat.decimalPattern('fr_FR');
String rdcNumber(num? value) => value == null ? '—' : _numberFormat.format(value);

String rdcDate(DateTime? date) => date == null ? '' : DateFormat('d MMMM y', 'fr_FR').format(date.toLocal());

// ------------------------------------------------------------------ navigation

Future<void> openRdcFiche(BuildContext context, String slug) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => RdcFicheScreen(slug: slug)));

Future<void> openRdcProvince(BuildContext context, String slug) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => RdcProvinceScreen(slug: slug)));

Future<void> openRdcExplorer(BuildContext context, {String? categorie, String? query, String? province, bool vedette = false}) =>
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => RdcExplorerScreen(categorieSlug: categorie, initialQuery: query, province: province, vedette: vedette),
    ));

// ------------------------------------------------------------------ chargement

/// Charge une donnée et affiche squelette, erreur (avec « Réessayer ») ou contenu.
class RdcLoader<T> extends StatefulWidget {
  const RdcLoader({super.key, required this.load, required this.builder, this.skeleton});

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;
  final Widget? skeleton;

  @override
  State<RdcLoader<T>> createState() => _RdcLoaderState<T>();
}

class _RdcLoaderState<T> extends State<RdcLoader<T>> {
  T? _data;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.load();
      if (mounted) setState(() => _data = data);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    if (data != null) return widget.builder(context, data, _reload);
    if (_error != null) {
      final error = _error;
      final notFound = error is ApiException && error.statusCode == 404;
      return StatusView.error(
        title: notFound ? 'Contenu introuvable' : 'Le chargement a échoué',
        message: error is ApiException ? error.message : 'Veuillez réessayer.',
        onAction: notFound ? null : _reload,
      );
    }
    if (_loading) return widget.skeleton ?? const RdcListSkeleton();
    return const SizedBox.shrink();
  }
}

class RdcListSkeleton extends StatelessWidget {
  const RdcListSkeleton({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.all(16),
        physics: const NeverScrollableScrollPhysics(),
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, _) => const ResourceTileSkeleton(),
      );
}

// ------------------------------------------------------------------ fiches

/// Ligne de liste d'une fiche (vignette, rubrique, titre, résumé).
class RdcFicheTile extends StatelessWidget {
  const RdcFicheTile({super.key, required this.fiche, this.showSummary = true});

  final RdcFiche fiche;
  final bool showSummary;

  @override
  Widget build(BuildContext context) {
    final color = fiche.categorie.couleur;
    return SurfaceCard(
      onTap: () => openRdcFiche(context, fiche.slug),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NetworkCover(
            url: fiche.image,
            width: 84,
            height: 84,
            fallback: _IconPlaceholder(icon: rdcIcon(fiche.categorie.icone), color: color, size: 84),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fiche.categorie.nom.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.3),
                ),
                const SizedBox(height: 3),
                Text(
                  fiche.titre,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, height: 1.25, color: AppColors.textPrimary),
                ),
                if (showSummary && fiche.resume.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    fiche.resume,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5, height: 1.35),
                  ),
                ],
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (fiche.natureLabel.isNotEmpty) Pill(fiche.natureLabel, color: color),
                    if (fiche.libelleDates.isNotEmpty) Pill(fiche.libelleDates, color: AppColors.textMuted, icon: CupertinoIcons.calendar),
                    if (fiche.provinces.isNotEmpty)
                      Pill(fiche.provinces.map((p) => p.nom).take(2).join(', '), color: AppColors.textMuted, icon: CupertinoIcons.location),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Carte verticale pour les carrousels (accueil, fiches liées).
class RdcFicheCard extends StatelessWidget {
  const RdcFicheCard({super.key, required this.fiche, this.width = 220});

  final RdcFiche fiche;
  final double width;

  @override
  Widget build(BuildContext context) {
    final color = fiche.categorie.couleur;
    return SizedBox(
      width: width,
      child: SurfaceCard(
        onTap: () => openRdcFiche(context, fiche.slug),
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                NetworkCover(
                  url: fiche.image,
                  width: width,
                  height: 120,
                  radius: 0,
                  fallback: _IconPlaceholder(icon: rdcIcon(fiche.categorie.icone), color: color, size: 120, width: width),
                ),
                if (fiche.libelleDates.isNotEmpty)
                  Positioned(
                    left: 8,
                    bottom: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.ink.withValues(alpha: 0.8), borderRadius: BorderRadius.circular(20)),
                      child: Text(fiche.libelleDates, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    fiche.categorie.nom.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.3),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    fiche.titre,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, height: 1.25),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    fiche.resume,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.35),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IconPlaceholder extends StatelessWidget {
  const _IconPlaceholder({required this.icon, required this.color, required this.size, this.width});

  final IconData icon;
  final Color color;
  final double size;
  final double? width;

  @override
  Widget build(BuildContext context) => Container(
        width: width ?? size,
        height: size,
        color: color.withValues(alpha: 0.08),
        alignment: Alignment.center,
        child: Icon(icon, color: color.withValues(alpha: 0.6), size: size * 0.32),
      );
}

/// Carrousel horizontal de fiches.
class RdcFicheCarousel extends StatelessWidget {
  const RdcFicheCarousel({super.key, required this.fiches});

  final List<RdcFiche> fiches;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 252,
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          scrollDirection: Axis.horizontal,
          itemCount: fiches.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (_, i) => RdcFicheCard(fiche: fiches[i]),
        ),
      );
}

/// Titre de section de l'encyclopédie, avec lien « Voir tout » optionnel.
class RdcSectionTitle extends StatelessWidget {
  const RdcSectionTitle(this.title, {super.key, this.action, this.onAction, this.icon});

  final String title;
  final String? action;
  final VoidCallback? onAction;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 22, 8, 10),
        child: Row(
          children: [
            if (icon != null) ...[Icon(icon, size: 18, color: AppColors.primary), const SizedBox(width: 8)],
            Expanded(
              child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            ),
            if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
          ],
        ),
      );
}
