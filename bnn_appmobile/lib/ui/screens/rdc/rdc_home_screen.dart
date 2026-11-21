import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/encyclopedie.dart';
import '../../../data/services/rdc_online_source.dart';
import '../../widgets/common.dart';
import '../../widgets/states.dart';
import 'rdc_carte_screen.dart';
import 'rdc_chronologie_screen.dart';
import 'rdc_provinces_screen.dart';
import 'rdc_widgets.dart';

/// Onglet « RDC » : accueil de l'encyclopédie numérique de la RDC.
class RdcHomeScreen extends StatefulWidget {
  const RdcHomeScreen({super.key});

  @override
  State<RdcHomeScreen> createState() => _RdcHomeScreenState();
}

class _RdcHomeScreenState extends State<RdcHomeScreen> {
  final _search = TextEditingController();
  Key _loaderKey = UniqueKey();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _submit(String value) {
    final query = value.trim();
    if (query.isEmpty) return;
    openRdcExplorer(context, query: query);
  }

  void _push(Widget screen) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          TabHeader(
            eyebrow: 'Encyclopédie numérique',
            title: 'RDC',
            subtitle: 'Histoire, géographie, infrastructures, énergie, biodiversité, ressources et patrimoine du Congo.',
            bottom: SearchField(
              controller: _search,
              hint: 'Rechercher dans l’encyclopédie',
              onSubmitted: _submit,
              onClear: () => _search.clear(),
              onDark: true,
            ),
          ),
          Expanded(
            child: RdcLoader<RdcAccueil>(
              key: _loaderKey,
              load: () => rdcService(context).accueil(),
              builder: (context, data, reload) => AppRefresh(
                onRefresh: () async => setState(() => _loaderKey = UniqueKey()),
                child: ListView(
                  padding: const EdgeInsets.only(bottom: 32),
                  children: [
                    _Stats(stats: data.stats),
                    _QuickActions(
                      onProvinces: () => _push(const RdcProvincesScreen()),
                      onChronologie: () => _push(const RdcChronologieScreen()),
                      onCarte: () => _push(const RdcCarteScreen()),
                    ),
                    const RdcSectionTitle('Grandes rubriques'),
                    for (final categorie in data.categories)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: _CategorieCard(categorie: categorie),
                      ),
                    if (data.periodes.isNotEmpty) ...[
                      RdcSectionTitle('Les grandes périodes', action: 'Chronologie', onAction: () => _push(const RdcChronologieScreen())),
                      SizedBox(
                        height: 76,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          scrollDirection: Axis.horizontal,
                          itemCount: data.periodes.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 10),
                          itemBuilder: (_, i) {
                            final p = data.periodes[i];
                            return SizedBox(
                              width: 170,
                              child: SurfaceCard(
                                onTap: () => _push(RdcChronologieScreen(initialPeriode: p.slug)),
                                borderColor: p.couleur.withValues(alpha: 0.5),
                                padding: const EdgeInsets.all(10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(p.libelleDates, style: TextStyle(color: p.couleur, fontSize: 11, fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 3),
                                    Text(p.nom, maxLines: 2, overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, height: 1.2)),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                    if (data.vedette.isNotEmpty) ...[
                      RdcSectionTitle('À la une', icon: CupertinoIcons.sparkles, action: 'Voir tout',
                          onAction: () => openRdcExplorer(context, vedette: true)),
                      RdcFicheCarousel(fiches: data.vedette),
                    ],
                    if (!data.online)
                      RdcSectionTitle('Dernières publications', action: data.recentes.isEmpty ? null : 'Explorer',
                          onAction: () => openRdcExplorer(context)),
                    if (data.online)
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 24, 16, 0),
                        child: Text(RdcOnlineSource.licenceNotice,
                            style: TextStyle(color: AppColors.textFaint, fontSize: 12, height: 1.4)),
                      )
                    else if (data.recentes.isEmpty)
                      const StatusView(
                        compact: true,
                        icon: CupertinoIcons.book,
                        title: 'Les premières fiches arrivent bientôt',
                        message: 'Les rubriques et les 26 provinces sont en place ; les fiches sont ajoutées progressivement.',
                      )
                    else
                      for (final fiche in data.recentes)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                          child: RdcFicheTile(fiche: fiche),
                        ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.stats});

  final Map<String, int> stats;

  @override
  Widget build(BuildContext context) {
    Widget stat(String label, String key) => Expanded(
          child: Column(
            children: [
              Text(rdcNumber(stats[key] ?? 0),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.primary)),
              const SizedBox(height: 2),
              Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted)),
            ],
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: SurfaceCard(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
        child: Row(children: [
          if (stats.containsKey('fiches')) stat('Fiches', 'fiches'),
          stat('Provinces', 'provinces'),
          if (stats.containsKey('medias')) stat('Médias', 'medias'),
          stat('Rubriques', 'categories'),
        ]),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onProvinces, required this.onChronologie, required this.onCarte});

  final VoidCallback onProvinces;
  final VoidCallback onChronologie;
  final VoidCallback onCarte;

  @override
  Widget build(BuildContext context) {
    Widget action(IconData icon, String label, VoidCallback onTap) => Expanded(
          child: SurfaceCard(
            onTap: onTap,
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
            child: Column(
              children: [
                Icon(icon, color: AppColors.primary),
                const SizedBox(height: 6),
                Text(label, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              ],
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          action(CupertinoIcons.compass, '26 provinces', onProvinces),
          const SizedBox(width: 10),
          action(CupertinoIcons.time, 'Chronologie', onChronologie),
          const SizedBox(width: 10),
          action(CupertinoIcons.map, 'Carte', onCarte),
        ],
      ),
    );
  }
}

class _CategorieCard extends StatelessWidget {
  const _CategorieCard({required this.categorie});

  final RdcCategorie categorie;

  @override
  Widget build(BuildContext context) {
    final color = categorie.couleur;
    final count = categorie.nbFiches;
    return SurfaceCard(
      onTap: () => openRdcExplorer(context, categorie: categorie.slug),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                child: Icon(rdcIcon(categorie.icone), color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(categorie.nom, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, height: 1.2)),
                    if (count != null) ...[
                      const SizedBox(height: 2),
                      Text('$count fiche${count > 1 ? 's' : ''}',
                          style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
                    ],
                  ],
                ),
              ),
              const Icon(CupertinoIcons.chevron_right, size: 16, color: AppColors.textFaint),
            ],
          ),
          if (categorie.description.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(categorie.description, style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.4)),
          ],
          if (categorie.enfants.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final enfant in categorie.enfants)
                  ActionChip(
                    label: Text((enfant.nbFiches ?? 0) > 0 ? '${enfant.nom} · ${enfant.nbFiches}' : enfant.nom),
                    labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    visualDensity: VisualDensity.compact,
                    side: const BorderSide(color: AppColors.border),
                    backgroundColor: AppColors.fill,
                    onPressed: () => openRdcExplorer(context, categorie: enfant.slug),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
