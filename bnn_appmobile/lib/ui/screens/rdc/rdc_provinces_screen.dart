import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/encyclopedie.dart';
import '../../widgets/common.dart';
import '../../widgets/states.dart';
import 'rdc_map.dart';
import 'rdc_widgets.dart';

String _normalize(String text) {
  const accents = {'à': 'a', 'â': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'ô': 'o', 'ù': 'u', 'û': 'u', 'ç': 'c'};
  return text.toLowerCase().split('').map((c) => accents[c] ?? c).join();
}

/// Les 26 provinces : liste filtrable ou carte.
class RdcProvincesScreen extends StatefulWidget {
  const RdcProvincesScreen({super.key});

  @override
  State<RdcProvincesScreen> createState() => _RdcProvincesScreenState();
}

class _RdcProvincesScreenState extends State<RdcProvincesScreen> {
  final _search = TextEditingController();
  bool _map = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Les 26 provinces'),
        actions: [
          IconButton(
            tooltip: _map ? 'Afficher la liste' : 'Afficher la carte',
            icon: Icon(_map ? CupertinoIcons.list_bullet : CupertinoIcons.map),
            onPressed: () => setState(() => _map = !_map),
          ),
        ],
      ),
      body: RdcLoader<List<RdcProvince>>(
        load: () => rdcService(context).provinces(),
        builder: (context, provinces, _) {
          final query = _normalize(_search.text.trim());
          final visible = query.isEmpty
              ? provinces
              : provinces.where((p) => _normalize(p.nom).contains(query) || _normalize(p.chefLieu).contains(query)).toList();
          if (_map) {
            return Padding(
              padding: const EdgeInsets.all(12),
              child: RdcMapView(features: [
                for (final p in visible)
                  if (p.latitude != null && p.longitude != null)
                    RdcMapFeature(
                      id: p.slug,
                      kind: 'province',
                      slug: p.slug,
                      titre: p.nom,
                      couleur: AppColors.navy,
                      image: p.image,
                      resume: p.chefLieu.isEmpty ? '' : 'Chef-lieu : ${p.chefLieu}',
                      geometry: {'type': 'Point', 'coordinates': [p.longitude, p.latitude]},
                    ),
              ]),
            );
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: SearchField(
                  controller: _search,
                  hint: 'Province ou chef-lieu',
                  onChanged: (_) => setState(() {}),
                  onClear: () => setState(_search.clear),
                ),
              ),
              Expanded(
                child: visible.isEmpty
                    ? const StatusView(icon: CupertinoIcons.search, title: 'Aucune province ne correspond')
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                        itemCount: visible.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) => _ProvinceTile(province: visible[i]),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ProvinceTile extends StatelessWidget {
  const _ProvinceTile({required this.province});

  final RdcProvince province;

  @override
  Widget build(BuildContext context) {
    final details = [
      if (province.superficie != null) '${rdcNumber(province.superficie)} km²',
      if (province.population != null) '${rdcNumber(province.population)} hab.',
      '${province.nbFiches} fiche${province.nbFiches > 1 ? 's' : ''}',
    ].join(' · ');
    return SurfaceCard(
      onTap: () => openRdcProvince(context, province.slug),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          NetworkCover(
            url: province.image,
            width: 56,
            height: 56,
            fallback: Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              color: AppColors.navy,
              child: Text(province.code.isEmpty ? province.nom.substring(0, 2).toUpperCase() : province.code,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(province.nom, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
                if (province.chefLieu.isNotEmpty)
                  Text('Chef-lieu : ${province.chefLieu}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                const SizedBox(height: 2),
                Text(details, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ],
            ),
          ),
          const Icon(CupertinoIcons.chevron_right, size: 16, color: AppColors.textFaint),
        ],
      ),
    );
  }
}
