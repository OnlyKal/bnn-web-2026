import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/encyclopedie.dart';
import 'rdc_map.dart';
import 'rdc_widgets.dart';

/// Carte générale de l'encyclopédie, avec couches par grande rubrique.
class RdcCarteScreen extends StatefulWidget {
  const RdcCarteScreen({super.key});

  @override
  State<RdcCarteScreen> createState() => _RdcCarteScreenState();
}

class _RdcCarteScreenState extends State<RdcCarteScreen> {
  List<RdcMapFeature>? _features;
  RdcFiltres? _filtres;
  String? _province;
  bool _capitals = true;
  final Set<String> _hidden = {};
  Object? _error;

  @override
  void initState() {
    super.initState();
    rdcService(context).filtres().then((f) {
      if (mounted) setState(() => _filtres = f);
    }).catchError((_) {});
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _features = null;
      _error = null;
    });
    try {
      final features = await rdcService(context).carte(province: _province, provinces: true);
      if (mounted) setState(() => _features = features);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  List<RdcMapFeature> get _visible => (_features ?? const [])
      .where((f) => f.kind == 'province' ? _capitals : !_hidden.contains(f.rubriqueSlug))
      .toList();

  Future<void> _openLayers() async {
    final categories = _filtres?.categories ?? const <RdcCategorie>[];
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) {
          void toggle(VoidCallback change) {
            setSheet(change);
            setState(() {});
          }

          final counts = <String, int>{};
          for (final f in _features ?? const <RdcMapFeature>[]) {
            if (f.rubriqueSlug != null) counts[f.rubriqueSlug!] = (counts[f.rubriqueSlug!] ?? 0) + 1;
          }
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(12, 0, 12, 8),
                    child: Text('Couches de la carte', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  ),
                  CheckboxListTile(
                    value: _capitals,
                    onChanged: (v) => toggle(() => _capitals = v ?? true),
                    secondary: const CircleAvatar(radius: 7, backgroundColor: AppColors.navy),
                    title: const Text('Chefs-lieux de province'),
                  ),
                  for (final c in categories)
                    CheckboxListTile(
                      value: !_hidden.contains(c.slug),
                      onChanged: (v) => toggle(() => v == true ? _hidden.remove(c.slug) : _hidden.add(c.slug)),
                      secondary: CircleAvatar(radius: 7, backgroundColor: c.couleur),
                      title: Text(c.nom),
                      subtitle: Text('${counts[c.slug] ?? 0} objet(s) localisé(s)'),
                    ),
                  if (_filtres != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: DropdownButtonFormField<String?>(
                        initialValue: _province,
                        isExpanded: true,
                        decoration: const InputDecoration(labelText: 'Province'),
                        items: [
                          const DropdownMenuItem<String?>(value: null, child: Text('Toute la RDC')),
                          for (final p in _filtres!.provinces) DropdownMenuItem<String?>(value: p.slug, child: Text(p.nom)),
                        ],
                        onChanged: (v) {
                          Navigator.of(sheet).pop();
                          _province = v;
                          _load();
                        },
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hiddenCount = _hidden.length + (_capitals ? 0 : 1) + (_province == null ? 0 : 1);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Carte interactive'),
        actions: [
          IconButton(
            tooltip: 'Couches et filtres',
            onPressed: _features == null ? null : _openLayers,
            icon: Badge(
              isLabelVisible: hiddenCount > 0,
              label: Text('$hiddenCount'),
              child: const Icon(CupertinoIcons.layers_alt),
            ),
          ),
        ],
      ),
      body: _error != null
          ? Center(
              child: TextButton.icon(
                onPressed: _load,
                icon: const Icon(CupertinoIcons.refresh),
                label: const Text('Le chargement a échoué — réessayer'),
              ),
            )
          : _features == null
              ? const Center(child: CircularProgressIndicator())
              : Padding(
                  padding: const EdgeInsets.all(8),
                  child: RdcMapView(key: ValueKey(_province), features: _visible),
                ),
    );
  }
}
