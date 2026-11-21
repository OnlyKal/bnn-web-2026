import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/html_text.dart';
import '../../../data/models/encyclopedie.dart';
import '../../widgets/common.dart';
import 'rdc_map.dart';
import 'rdc_media.dart';
import 'rdc_widgets.dart';

/// Page complète d'une province : chiffres clés, carte, géographie, localités, fiches.
class RdcProvinceScreen extends StatelessWidget {
  const RdcProvinceScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    final service = rdcService(context);
    return Scaffold(
      body: RdcLoader<(RdcProvinceDetail, List<RdcMapFeature>)>(
        load: () async {
          final results = await Future.wait([
            service.province(slug),
            service.carte(province: slug).catchError((_) => <RdcMapFeature>[]),
          ]);
          return (results[0] as RdcProvinceDetail, results[1] as List<RdcMapFeature>);
        },
        skeleton: Scaffold(appBar: AppBar(), body: const RdcListSkeleton(count: 3)),
        builder: (context, data, _) => _ProvinceBody(detail: data.$1, located: data.$2),
      ),
    );
  }
}

class _ProvinceBody extends StatelessWidget {
  const _ProvinceBody({required this.detail, required this.located});

  final RdcProvinceDetail detail;
  final List<RdcMapFeature> located;

  @override
  Widget build(BuildContext context) {
    final p = detail.province;
    final description = htmlToPlainText(detail.description);
    final density = p.population != null && (p.superficie ?? 0) > 0 ? (p.population! / p.superficie!).round() : null;
    final center = p.latitude != null && p.longitude != null ? LatLng(p.latitude!, p.longitude!) : null;
    final features = [
      ...located,
      for (final l in detail.localites)
        if (l.latitude != null && l.longitude != null)
          RdcMapFeature(
            id: 'loc-${l.nom}',
            kind: 'localite',
            titre: l.nom,
            couleur: AppColors.textSecondary,
            categorie: 'Villes et territoires',
            resume: l.typeLabel,
            geometry: {'type': 'Point', 'coordinates': [l.longitude, l.latitude]},
          ),
    ];
    final keyFacts = <MapEntry<String, String>>[
      if (p.chefLieu.isNotEmpty) MapEntry('Chef-lieu', p.chefLieu),
      MapEntry('Superficie', p.superficie == null ? '—' : '${rdcNumber(p.superficie)} km²'),
      MapEntry(p.anneePopulation == null ? 'Population' : 'Population (${p.anneePopulation})',
          p.population == null ? '—' : rdcNumber(p.population)),
      if (density != null) MapEntry('Densité', '${rdcNumber(density)} hab./km²'),
      if (detail.langues.isNotEmpty) MapEntry('Langues', detail.langues),
      MapEntry('Fiches liées', rdcNumber(p.nbFiches)),
      for (final d in detail.donnees) MapEntry(d.libelle, d.texte),
    ];

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: detail.imagePrincipale != null ? 220 : null,
          backgroundColor: AppColors.navy,
          foregroundColor: Colors.white,
          iconTheme: const IconThemeData(color: Colors.white),
          actionsIconTheme: const IconThemeData(color: Colors.white),
          titleTextStyle: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
          title: Text(p.nom),
          flexibleSpace: detail.imagePrincipale == null
              ? null
              : FlexibleSpaceBar(
                  background: Stack(fit: StackFit.expand, children: [
                    NetworkCover(url: detail.imagePrincipale, radius: 0),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0x99000000), Color(0x00000000)],
                        ),
                      ),
                    ),
                  ]),
                ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('PROVINCE${p.code.isEmpty ? '' : ' · ${p.code}'}',
                    style: const TextStyle(color: AppColors.primary, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.4)),
                const SizedBox(height: 4),
                Text(p.nom, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                if (p.presentation.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(p.presentation, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, height: 1.5)),
                ],
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  SelectableText(description, style: const TextStyle(fontSize: 15, height: 1.6, color: AppColors.textSecondary)),
                ],
                if (p.presentation.isEmpty && description.isEmpty && detail.sections.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 10),
                    child: Text('La description détaillée de cette province est en cours de rédaction.',
                        style: TextStyle(color: AppColors.textMuted)),
                  ),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: RdcSectionTitle('Chiffres clés')),
        SliverToBoxAdapter(child: RdcFactsCard(rows: keyFacts)),
        const SliverToBoxAdapter(child: RdcSectionTitle('Carte de la province')),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SizedBox(
              height: 240,
              child: RdcMapView(
                features: features,
                contour: detail.contour,
                center: center,
                zoom: p.zoom.toDouble(),
                interactive: false,
                onOpenFullScreen: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => RdcMapFullScreen(
                    title: p.nom,
                    features: features,
                    contour: detail.contour,
                    center: center,
                    zoom: p.zoom.toDouble(),
                  ),
                )),
              ),
            ),
          ),
        ),
        for (final section in detail.sections) ...[
          SliverToBoxAdapter(child: RdcSectionTitle(section.key)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(section.value, style: const TextStyle(fontSize: 14.5, height: 1.6, color: AppColors.textSecondary)),
            ),
          ),
        ],
        if (detail.localites.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Villes et territoires')),
          SliverToBoxAdapter(
            child: RdcFactsCard(rows: [
              for (final l in detail.localites)
                MapEntry(
                  l.nom,
                  [l.typeLabel, if (l.chefLieu.isNotEmpty) 'chef-lieu : ${l.chefLieu}', if (l.population != null) '${rdcNumber(l.population)} hab.']
                      .join(' · '),
                ),
            ]),
          ),
        ],
        if (detail.medias.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Galerie et documents')),
          SliverToBoxAdapter(child: RdcMediaGallery(medias: detail.medias)),
        ],
        for (final rubrique in detail.rubriques) ...[
          SliverToBoxAdapter(
            child: RdcSectionTitle(
              rubrique.categorie.nom,
              icon: rdcIcon(rubrique.categorie.icone),
              action: rubrique.total > rubrique.fiches.length ? 'Les ${rubrique.total}' : null,
              onAction: () => openRdcExplorer(context, categorie: rubrique.categorie.slug, province: p.slug),
            ),
          ),
          SliverToBoxAdapter(child: RdcFicheCarousel(fiches: rubrique.fiches)),
        ],
        if (detail.sources.isNotEmpty) ...[
          const SliverToBoxAdapter(child: RdcSectionTitle('Sources')),
          SliverToBoxAdapter(child: RdcSourcesList(sources: detail.sources)),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 40)),
      ],
    );
  }
}
