import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/html_text.dart';
import '../../../data/models/encyclopedie.dart';
import '../../../data/services/rdc_online_source.dart';
import '../../widgets/common.dart';
import 'rdc_map.dart';
import 'rdc_media.dart';
import 'rdc_widgets.dart';

/// Fiche documentaire complète.
class RdcFicheScreen extends StatelessWidget {
  const RdcFicheScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RdcLoader<RdcFicheDetail>(
        load: () => rdcService(context).fiche(slug),
        skeleton: Scaffold(appBar: AppBar(), body: const RdcListSkeleton(count: 3)),
        builder: (context, detail, _) => _FicheBody(detail: detail),
      ),
    );
  }
}

class _FicheBody extends StatelessWidget {
  const _FicheBody({required this.detail});

  final RdcFicheDetail detail;

  List<RdcMapFeature> get _features {
    final f = detail.fiche;
    final props = (
      titre: f.titre,
      couleur: f.categorie.couleur,
      categorie: f.categorie.nom,
    );
    return [
      if (detail.geometrie != null)
        RdcMapFeature(
          id: 'geo',
          kind: 'localite', // pas de lien : on est déjà sur la fiche
          titre: props.titre,
          couleur: props.couleur,
          categorie: props.categorie,
          geometry: detail.geometrie!['type'] == 'Feature'
              ? Map<String, dynamic>.from(detail.geometrie!['geometry'] as Map)
              : detail.geometrie!,
        ),
      if (f.latitude != null && f.longitude != null)
        RdcMapFeature(
          id: 'pt',
          kind: 'localite',
          titre: props.titre,
          couleur: props.couleur,
          categorie: props.categorie,
          resume: detail.lieu,
          geometry: {'type': 'Point', 'coordinates': [f.longitude, f.latitude]},
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final f = detail.fiche;
    final color = f.categorie.couleur;
    final contenu = htmlToPlainText(detail.contenu);
    final features = _features;
    final facts = <MapEntry<String, String>>[
      MapEntry('Rubrique', detail.filAriane.map((c) => c.nom).join(' › ')),
      MapEntry('Type', f.natureLabel),
      if (detail.periode != null) MapEntry('Période', '${detail.periode!.nom} (${detail.periode!.libelleDates})'),
      if (f.libelleDates.isNotEmpty) MapEntry('Date(s)', f.libelleDates),
      if (detail.lieu.isNotEmpty) MapEntry('Localisation', detail.lieu),
      if (f.provinces.isNotEmpty) MapEntry('Province(s)', f.provinces.map((p) => p.nom).join(', ')),
      if (detail.localites.isNotEmpty) MapEntry('Villes / territoires', detail.localites.join(', ')),
      for (final d in detail.donnees) MapEntry(d.libelle, d.texte),
    ];

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: detail.imagePrincipale != null ? 240 : null,
          backgroundColor: AppColors.navy,
          foregroundColor: Colors.white,
          iconTheme: const IconThemeData(color: Colors.white),
          actionsIconTheme: const IconThemeData(color: Colors.white),
          titleTextStyle: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
          title: Text(f.titre, maxLines: 1, overflow: TextOverflow.ellipsis),
          actions: [
            IconButton(
              tooltip: 'Partager',
              icon: const Icon(CupertinoIcons.share),
              onPressed: () => SharePlus.instance.share(ShareParams(text: '${f.titre}\n\n${f.resume}')),
            ),
          ],
          flexibleSpace: detail.imagePrincipale == null
              ? null
              : FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      NetworkCover(url: detail.imagePrincipale, radius: 0),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0x99000000), Color(0x00000000), Color(0x66000000)],
                          ),
                        ),
                      ),
                      if (detail.creditImage.isNotEmpty)
                        Positioned(
                          right: 8,
                          bottom: 6,
                          child: Text('© ${detail.creditImage}', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                        ),
                    ],
                  ),
                ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: () => openRdcExplorer(context, categorie: f.categorie.slug),
                  child: Row(
                    children: [
                      Icon(rdcIcon(f.categorie.icone), size: 15, color: color),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(f.categorie.nom.toUpperCase(),
                            style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Semantics(
                  header: true,
                  child: Text(f.titre, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, height: 1.2)),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    Pill(f.natureLabel, color: color),
                    if (f.libelleDates.isNotEmpty) Pill(f.libelleDates, color: AppColors.textMuted, icon: CupertinoIcons.calendar),
                    for (final p in f.provinces)
                      GestureDetector(
                        onTap: () => openRdcProvince(context, p.slug),
                        child: Pill(p.nom, icon: CupertinoIcons.location),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.only(left: 12),
                  decoration: BoxDecoration(border: Border(left: BorderSide(color: color, width: 3))),
                  child: Text(f.resume, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, height: 1.5)),
                ),
                if (contenu.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SelectableText(contenu, style: const TextStyle(fontSize: 15, height: 1.65, color: AppColors.textSecondary)),
                ],
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: RdcSectionTitle('Fiche technique')),
        SliverToBoxAdapter(child: RdcFactsCard(rows: facts)),
        if (features.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Localisation')),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                height: 220,
                child: RdcMapView(
                  features: features,
                  interactive: false,
                  center: f.latitude != null ? LatLng(f.latitude!, f.longitude!) : null,
                  zoom: 9,
                  onOpenFullScreen: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => RdcMapFullScreen(
                      title: f.titre,
                      features: features,
                      center: f.latitude != null ? LatLng(f.latitude!, f.longitude!) : null,
                      zoom: 9,
                    ),
                  )),
                ),
              ),
            ),
          ),
        ],
        if (detail.medias.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Galerie et documents')),
          SliverToBoxAdapter(child: RdcMediaGallery(medias: detail.medias)),
        ],
        if (detail.sources.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Sources et références')),
          SliverToBoxAdapter(child: RdcSourcesList(sources: detail.sources)),
        ],
        if (detail.motsCles.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Mots-clés')),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final mot in detail.motsCles)
                    ActionChip(
                      label: Text(mot),
                      visualDensity: VisualDensity.compact,
                      onPressed: () => openRdcExplorer(context, query: mot),
                    ),
                ],
              ),
            ),
          ),
        ],
        if (detail.fichesLiees.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Pour aller plus loin')),
          SliverToBoxAdapter(child: RdcFicheCarousel(fiches: detail.fichesLiees)),
        ],
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
            child: Text(
              detail.online
                  ? RdcOnlineSource.licenceNotice
                  : 'Mise à jour le ${rdcDate(detail.dateMiseAJour)} · ${rdcPlural(detail.vues, 'consultation')}',
              style: const TextStyle(color: AppColors.textFaint, fontSize: 12, height: 1.4),
            ),
          ),
        ),
      ],
    );
  }
}
