import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/encyclopedie.dart';
import '../../widgets/common.dart';
import '../../widgets/states.dart';
import 'rdc_widgets.dart';

/// Chronologie interactive : périodes, événements, personnalités.
class RdcChronologieScreen extends StatefulWidget {
  const RdcChronologieScreen({super.key, this.initialPeriode, this.initialCategorie});

  final String? initialPeriode;
  final String? initialCategorie;

  @override
  State<RdcChronologieScreen> createState() => _RdcChronologieScreenState();
}

class _RdcChronologieScreenState extends State<RdcChronologieScreen> {
  late String? _periode = widget.initialPeriode;
  late String? _categorie = widget.initialCategorie;
  String _nature = '';
  Key _key = UniqueKey();

  static const _natures = [
    SegmentOption('', 'Tout'),
    SegmentOption('evenement', 'Événements'),
    SegmentOption('personnalite', 'Personnalités'),
  ];

  void _update(VoidCallback change) => setState(() {
        change();
        _key = UniqueKey();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chronologie')),
      body: RdcLoader(
        key: _key,
        load: () => rdcService(context).chronologie(periode: _periode, nature: _nature, categorie: _categorie),
        builder: (context, data, _) {
          final periodes = data.periodes;
          final selected = periodes.where((p) => p.slug == _periode).firstOrNull;
          return ListView(
            padding: const EdgeInsets.only(bottom: 40),
            children: [
              SizedBox(
                height: 70,
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  scrollDirection: Axis.horizontal,
                  itemCount: periodes.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final p = periodes[i];
                    final active = p.slug == _periode;
                    return Material(
                      color: active ? p.couleur : p.couleur.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => _update(() => _periode = active ? null : p.slug),
                        child: Container(
                          width: 150,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border(bottom: BorderSide(color: p.couleur, width: 3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(p.nom, maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: active ? Colors.white : AppColors.textPrimary)),
                              Text(p.libelleDates,
                                  style: TextStyle(fontSize: 11, color: active ? Colors.white70 : AppColors.textMuted)),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                child: Segmented<String>(
                  options: _natures,
                  value: _nature,
                  onChanged: (v) => _update(() => _nature = v),
                ),
              ),
              if (_categorie != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: InputChip(
                      label: const Text('Filtré sur une rubrique'),
                      onDeleted: () => _update(() => _categorie = null),
                    ),
                  ),
                ),
              if (selected != null && selected.resume.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: SurfaceCard(
                    borderColor: selected.couleur.withValues(alpha: 0.4),
                    child: Text(selected.resume, style: const TextStyle(height: 1.5)),
                  ),
                ),
              if (data.evenements.isEmpty)
                const StatusView(
                  icon: CupertinoIcons.calendar,
                  title: 'Aucun élément daté',
                  message: 'Les fiches datées apparaîtront ici dès leur publication.',
                )
              else
                ..._timeline(data.evenements, periodes),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _timeline(List<RdcFiche> events, List<RdcPeriode> periodes) {
    RdcPeriode? periodOf(RdcFiche e) =>
        periodes.where((p) => p.slug == e.periodeSlug).firstOrNull ?? periodes.where((p) => p.contains(e.anneeDebut!)).firstOrNull;

    final widgets = <Widget>[];
    String? currentPeriod = '__start';
    int? currentYear;
    for (final event in events) {
      final period = periodOf(event);
      if (period?.slug != currentPeriod) {
        currentPeriod = period?.slug;
        currentYear = null;
        widgets.add(Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(color: period?.couleur ?? AppColors.textMuted, borderRadius: BorderRadius.circular(10)),
          child: Row(
            children: [
              Expanded(
                child: Text(period?.nom ?? 'Autres dates',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              ),
              if (period != null) Text(period.libelleDates, style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ));
      }
      final color = period?.couleur ?? AppColors.textMuted;
      final showYear = event.anneeDebut != currentYear;
      currentYear = event.anneeDebut;
      widgets.add(IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 64,
              child: Column(
                children: [
                  if (showYear)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(
                        event.anneeDebut! < 0 ? '${-event.anneeDebut!} av. J.-C.' : '${event.anneeDebut}',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 15),
                      ),
                    ),
                  Expanded(child: Center(child: Container(width: 2, color: color.withValues(alpha: 0.25)))),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(right: 16, bottom: 10),
                child: SurfaceCard(
                  onTap: () => openRdcFiche(context, event.slug),
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(event.nature == 'personnalite' ? CupertinoIcons.person : rdcIcon(event.categorie.icone),
                              size: 13, color: color),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              [event.natureLabel, if (event.libelleDates != '${event.anneeDebut}') event.libelleDates].join(' · ').toUpperCase(),
                              style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w800),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(event.titre, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      if (event.resume.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(event.resume, maxLines: 2, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5, height: 1.35)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ));
    }
    return widgets;
  }
}
