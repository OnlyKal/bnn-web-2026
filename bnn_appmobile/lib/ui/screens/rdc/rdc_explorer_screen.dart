import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/models/encyclopedie.dart';
import '../../widgets/common.dart';
import '../../widgets/states.dart';
import 'rdc_chronologie_screen.dart';
import 'rdc_map.dart';
import 'rdc_widgets.dart';

/// Liste filtrable des fiches : page d'une rubrique ou recherche globale.
class RdcExplorerScreen extends StatefulWidget {
  const RdcExplorerScreen({super.key, this.categorieSlug, this.initialQuery, this.province, this.vedette = false});

  final String? categorieSlug;
  final String? initialQuery;
  final String? province;
  final bool vedette;

  @override
  State<RdcExplorerScreen> createState() => _RdcExplorerScreenState();
}

class _RdcExplorerScreenState extends State<RdcExplorerScreen> {
  late final TextEditingController _search = TextEditingController(text: widget.initialQuery ?? '');
  final _scroll = ScrollController();

  RdcCategorieDetail? _categorie;
  RdcFiltres? _filtres;
  String? _sous;
  late String? _province = widget.province;
  String? _nature;
  String? _periode;
  String? _ordering;

  final List<RdcFiche> _items = [];
  int _page = 0;
  int _count = 0;
  bool _hasNext = true;
  bool _loading = false;
  Object? _error;
  int _requestId = 0;

  bool _mapMode = false;
  List<RdcMapFeature>? _features;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 600) _loadMore();
    });
    _init();
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final service = rdcService(context);
    if (widget.categorieSlug != null) {
      try {
        final detail = await service.categorie(widget.categorieSlug!);
        if (mounted) setState(() => _categorie = detail);
      } catch (e) {
        if (mounted) setState(() => _error = e);
        return;
      }
    }
    service.filtres().then((f) {
      if (mounted) setState(() => _filtres = f);
    }).catchError((_) {});
    _reset();
  }

  String? get _categorieFilter => _sous ?? widget.categorieSlug;
  int get _activeFilters => [_sous, _province, _nature, _periode].where((v) => v != null).length;

  void _reset() {
    _requestId++;
    setState(() {
      _items.clear();
      _page = 0;
      _hasNext = true;
      _error = null;
      _loading = false;
      _features = null;
    });
    if (_mapMode) _loadMap();
    _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasNext) return;
    final id = _requestId;
    setState(() => _loading = true);
    try {
      final result = await rdcService(context).fiches(
        q: _search.text,
        categorie: _categorieFilter,
        province: _province,
        nature: _nature,
        periode: _periode,
        ordering: _ordering,
        vedette: widget.vedette,
        page: _page + 1,
      );
      if (!mounted || id != _requestId) return;
      setState(() {
        _items.addAll(result.items);
        _page = result.page;
        _count = result.count;
        _hasNext = result.hasNext;
      });
    } catch (e) {
      if (mounted && id == _requestId) setState(() => _error = e);
    } finally {
      if (mounted && id == _requestId) setState(() => _loading = false);
    }
  }

  Future<void> _loadMap() async {
    final id = _requestId;
    try {
      final features = await rdcService(context).carte(categorie: _categorieFilter, province: _province);
      if (mounted && id == _requestId) setState(() => _features = features);
    } catch (e) {
      if (mounted && id == _requestId) setState(() => _features = const []);
    }
  }

  Future<void> _openFilters() async {
    final filtres = _filtres;
    if (filtres == null) return;
    String? province = _province, nature = _nature, periode = _periode, ordering = _ordering;
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) {
          Widget dropdown(String label, String? value, List<MapEntry<String, String>> options, ValueChanged<String?> onChanged) =>
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: DropdownButtonFormField<String?>(
                  initialValue: value,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: label),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Tous')),
                    for (final o in options) DropdownMenuItem<String?>(value: o.key, child: Text(o.value, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: onChanged,
                ),
              );
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.of(sheet).viewInsets.bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Filtres', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 16),
                  dropdown('Province', province, [for (final p in filtres.provinces) MapEntry(p.slug, p.nom)],
                      (v) => setSheet(() => province = v)),
                  dropdown('Type de fiche', nature, filtres.natures, (v) => setSheet(() => nature = v)),
                  dropdown('Période', periode, [for (final p in filtres.periodes) MapEntry(p.slug, p.nom)],
                      (v) => setSheet(() => periode = v)),
                  dropdown('Trier par', ordering, const [
                    MapEntry('titre', 'Titre (A → Z)'),
                    MapEntry('recent', 'Mises à jour récentes'),
                    MapEntry('chronologique', 'Chronologique'),
                    MapEntry('populaire', 'Les plus consultées'),
                  ], (v) => setSheet(() => ordering = v)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setSheet(() => province = nature = periode = ordering = null),
                          child: const Text('Réinitialiser'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(onPressed: () => Navigator.of(sheet).pop(true), child: const Text('Appliquer')),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (applied == true) {
      _province = province;
      _nature = nature;
      _periode = periode;
      _ordering = ordering;
      _reset();
    }
  }

  @override
  Widget build(BuildContext context) {
    final categorie = _categorie?.categorie;
    final mapAllowed = widget.categorieSlug == null || (_categorie?.carte ?? false);
    final title = categorie?.nom ?? (widget.vedette ? 'À la une' : 'Explorer');
    final color = categorie?.couleur ?? AppColors.primary;

    return Scaffold(
      appBar: AppBar(
        title: Text(title, overflow: TextOverflow.ellipsis),
        actions: [
          if (_categorie?.chronologie ?? false)
            IconButton(
              tooltip: 'Chronologie',
              icon: const Icon(CupertinoIcons.time),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => RdcChronologieScreen(initialCategorie: widget.categorieSlug),
              )),
            ),
          if (mapAllowed)
            IconButton(
              tooltip: _mapMode ? 'Afficher la liste' : 'Afficher la carte',
              icon: Icon(_mapMode ? CupertinoIcons.list_bullet : CupertinoIcons.map),
              onPressed: () {
                setState(() => _mapMode = !_mapMode);
                if (_mapMode && _features == null) _loadMap();
              },
            ),
          IconButton(
            tooltip: 'Filtres',
            onPressed: _filtres == null ? null : _openFilters,
            icon: Badge(
              isLabelVisible: _activeFilters > 0,
              label: Text('$_activeFilters'),
              child: const Icon(CupertinoIcons.slider_horizontal_3),
            ),
          ),
        ],
      ),
      body: _error != null && _items.isEmpty
          ? StatusView.error(
              message: _error is ApiException ? (_error as ApiException).message : null,
              onAction: _categorie == null && widget.categorieSlug != null ? _init : _reset,
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: SearchField(
                    controller: _search,
                    hint: categorie == null ? 'Rechercher une fiche' : 'Rechercher dans cette rubrique',
                    onSubmitted: (_) => _reset(),
                    onClear: () {
                      _search.clear();
                      _reset();
                    },
                  ),
                ),
                if (categorie != null && categorie.description.isNotEmpty && !_mapMode)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                    child: Text(categorie.description, style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.4)),
                  ),
                if (categorie != null && categorie.enfants.isNotEmpty)
                  SizedBox(
                    height: 52,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      scrollDirection: Axis.horizontal,
                      children: [
                        _Chip(label: 'Tout', selected: _sous == null, color: color, onTap: () {
                          _sous = null;
                          _reset();
                        }),
                        for (final sub in categorie.enfants)
                          _Chip(
                            label: (sub.nbFiches ?? 0) > 0 ? '${sub.nom} · ${sub.nbFiches}' : sub.nom,
                            selected: _sous == sub.slug,
                            color: color,
                            onTap: () {
                              _sous = sub.slug;
                              _reset();
                            },
                          ),
                      ],
                    ),
                  ),
                Expanded(child: _mapMode ? _buildMap() : _buildList()),
              ],
            ),
    );
  }

  Widget _buildMap() {
    final features = _features;
    if (features == null) return const Center(child: CircularProgressIndicator());
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: Column(
        children: [
          if (features.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('Aucune fiche localisée ne correspond à ces critères.', style: TextStyle(color: AppColors.textMuted)),
            ),
          Expanded(child: RdcMapView(features: features)),
        ],
      ),
    );
  }

  Widget _buildList() {
    if (_items.isEmpty && _loading) return const RdcListSkeleton();
    if (_items.isEmpty) {
      return StatusView(
        icon: CupertinoIcons.search,
        title: 'Aucune fiche trouvée',
        message: _search.text.isNotEmpty || _activeFilters > 0
            ? 'Essayez d’autres mots-clés ou retirez des filtres.'
            : 'Cette rubrique sera enrichie prochainement.',
      );
    }
    return AppRefresh(
      onRefresh: () async => _reset(),
      child: ListView.separated(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        itemCount: _items.length + 2,
        separatorBuilder: (_, i) => SizedBox(height: i == 0 ? 2 : 10),
        itemBuilder: (context, i) {
          if (i == 0) {
            return Text('${rdcNumber(_count)} fiche${_count > 1 ? 's' : ''}',
                style: const TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600, fontSize: 12.5));
          }
          if (i == _items.length + 1) {
            if (_loading) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
            if (_error != null) {
              return TextButton(onPressed: _loadMore, child: const Text('Erreur de chargement — réessayer'));
            }
            return const SizedBox.shrink();
          }
          return RdcFicheTile(fiche: _items[i - 1]);
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.color, required this.onTap});

  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => onTap(),
          showCheckmark: false,
          labelStyle: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.textSecondary,
          ),
          selectedColor: color,
          backgroundColor: AppColors.surface,
          side: BorderSide(color: selected ? color : AppColors.border),
        ),
      );
}
